from datetime import datetime, timedelta, timezone
from typing import Set, Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import logger
from app.db.base import utc_now
from app.db.models.adaptation import ConsentLedger, StudentPreference, TrustProfile
from app.llm.decision_layer import Proposal


class ConsentLedgerEngine:
    """Manages the append-only Consent Ledger and trust profiles (PROJECT.md §6, §9, §10.6).
    Rule: Never executes UPDATE or DELETE on ConsentLedger.
    """

    @staticmethod
    async def get_active_cooldown_types(
        session: AsyncSession,
        student_id: str,
        cooldown_minutes: Optional[int] = None,
    ) -> Set[str]:
        minutes = cooldown_minutes or settings.CONSENT_COOLDOWN_MINUTES
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)

        stmt = select(ConsentLedger.proposal_type).where(
            and_(
                ConsentLedger.student_id == student_id,
                ConsentLedger.status == "declined",
                ConsentLedger.created_at >= cutoff,
            )
        )
        res = await session.execute(stmt)
        return set(res.scalars().all())

    @staticmethod
    async def record_pending_proposal(
        session: AsyncSession,
        student_id: str,
        proposal: Proposal,
    ) -> ConsentLedger:
        """Appends a new pending proposal row to the ledger."""
        entry = ConsentLedger(
            student_id=student_id,
            proposal_type=proposal.type,
            proposal_payload=proposal.payload,
            proposed_by_agent=proposal.agent,
            priority_class=proposal.priority_class,
            status="pending",
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    @staticmethod
    async def record_auto_applied_proposal(
        session: AsyncSession,
        student_id: str,
        proposal: Proposal,
    ) -> ConsentLedger:
        """Appends an auto-applied proposal row to the ledger."""
        entry = ConsentLedger(
            student_id=student_id,
            proposal_type=proposal.type,
            proposal_payload=proposal.payload,
            proposed_by_agent=proposal.agent,
            priority_class=proposal.priority_class,
            status="auto_applied",
            decided_by="system",
            decided_at=utc_now(),
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    @staticmethod
    async def record_decision(
        session: AsyncSession,
        student_id: str,
        ledger_id: str,
        decision: str,  # approved | declined
        decided_by: str,  # student | parent
    ) -> ConsentLedger:
        """Appends a NEW decision row referencing supersedes_id (Append-only rule)."""
        if decision not in ("approved", "declined"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision must be 'approved' or 'declined'.",
            )

        # Retrieve original proposal
        stmt = select(ConsentLedger).where(
            and_(
                ConsentLedger.id == ledger_id,
                ConsentLedger.student_id == student_id,
            )
        )
        res = await session.execute(stmt)
        original = res.scalar_one_or_none()
        if not original:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consent ledger proposal not found.",
            )

        # Append new row
        decision_row = ConsentLedger(
            student_id=student_id,
            proposal_type=original.proposal_type,
            proposal_payload=original.proposal_payload,
            proposed_by_agent=original.proposed_by_agent,
            priority_class=original.priority_class,
            status=decision,
            decided_by=decided_by,
            decided_at=utc_now(),
            supersedes_id=original.id,
        )
        session.add(decision_row)

        # Update or initialize TrustProfile
        tp_stmt = select(TrustProfile).where(TrustProfile.student_id == student_id)
        tp_res = await session.execute(tp_stmt)
        trust_profile = tp_res.scalar_one_or_none()
        if not trust_profile:
            trust_profile = TrustProfile(student_id=student_id, accepted_count=0, declined_count=0)
            session.add(trust_profile)

        if decision == "approved":
            trust_profile.accepted_count += 1
            # Persist setting to StudentPreference
            pref_stmt = select(StudentPreference).where(
                and_(
                    StudentPreference.student_id == student_id,
                    StudentPreference.key == original.proposal_type,
                )
            )
            pref_res = await session.execute(pref_stmt)
            pref = pref_res.scalar_one_or_none()
            if not pref:
                pref = StudentPreference(
                    student_id=student_id,
                    key=original.proposal_type,
                    value=original.proposal_payload,
                )
                session.add(pref)
            else:
                pref.value = original.proposal_payload
        else:
            trust_profile.declined_count += 1

        trust_profile.last_updated = utc_now()

        await session.commit()
        await session.refresh(decision_row)
        return decision_row

    @staticmethod
    async def get_pending_proposals(
        session: AsyncSession,
        student_id: str,
    ) -> List[ConsentLedger]:
        """Returns active pending proposals for a student that have not been superseded."""
        # Find supersedes_ids that exist
        superseded_stmt = select(ConsentLedger.supersedes_id).where(
            and_(
                ConsentLedger.student_id == student_id,
                ConsentLedger.supersedes_id.isnot(None),
            )
        )
        res_superseded = await session.execute(superseded_stmt)
        superseded_ids = set(res_superseded.scalars().all())

        # Select pending proposals not in superseded_ids
        stmt = select(ConsentLedger).where(
            and_(
                ConsentLedger.student_id == student_id,
                ConsentLedger.status == "pending",
            )
        ).order_by(ConsentLedger.created_at.desc())

        res = await session.execute(stmt)
        candidates = res.scalars().all()
        return [c for c in candidates if c.id not in superseded_ids]
