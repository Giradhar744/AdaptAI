from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student, DisabilityProfile
from app.db.models.adaptation import ConsentLedger, StudentPreference, TrustProfile
from app.engine.consent_ledger import ConsentLedgerEngine
from app.agents.consent_trust import ConsentTrustAgent
from app.schemas.consent import (
    ConsentLedgerItem,
    PendingProposalResponse,
    TrustProfileResponse,
    StudentPreferenceResponse,
)


class ConsentService:

    @staticmethod
    async def get_pending_proposals(
        session: AsyncSession,
        current_user: User,
        student_id: str,
    ) -> List[PendingProposalResponse]:
        # Validate student existence and get profile
        s_stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(
                selectinload(Student.disabilities).selectinload(DisabilityProfile.disability_type),
                selectinload(Student.age_band),
            )
        )
        s_res = await session.execute(s_stmt)
        student = s_res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

        age_band = student.age_band.code if student.age_band else "11-15"
        disability = student.disabilities[0].disability_type.code if student.disabilities and student.disabilities[0].disability_type else None

        pending_rows = await ConsentLedgerEngine.get_pending_proposals(session, student_id)

        responses = []
        for r in pending_rows:
            title, rationale, action = ConsentTrustAgent.format_plain_language_prompt(
                proposal_type=r.proposal_type,
                proposal_payload=r.proposal_payload,
                age_band=age_band,
                disability_type=disability,
            )
            responses.append(
                PendingProposalResponse(
                    ledger_id=r.id,
                    student_id=r.student_id,
                    proposal_type=r.proposal_type,
                    proposed_by_agent=r.proposed_by_agent,
                    priority_class=r.priority_class,
                    plain_title=title,
                    plain_rationale=rationale,
                    proposed_action=action,
                    proposal_payload=r.proposal_payload,
                    created_at=r.created_at.isoformat(),
                )
            )

        return responses

    @staticmethod
    async def record_decision(
        session: AsyncSession,
        current_user: User,
        ledger_id: str,
        decision: str,
        decided_by: str = "student",
    ) -> ConsentLedgerItem:
        # Fetch ledger item to know student_id
        res = await session.execute(select(ConsentLedger).where(ConsentLedger.id == ledger_id))
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consent proposal not found.")

        student_id = item.student_id

        # Record decision append-only
        new_row = await ConsentLedgerEngine.record_decision(
            session=session,
            student_id=student_id,
            ledger_id=ledger_id,
            decision=decision,
            decided_by=decided_by,
        )

        return ConsentLedgerItem(
            id=new_row.id,
            student_id=new_row.student_id,
            proposal_type=new_row.proposal_type,
            proposal_payload=new_row.proposal_payload,
            proposed_by_agent=new_row.proposed_by_agent,
            priority_class=new_row.priority_class,
            status=new_row.status,
            decided_by=new_row.decided_by,
            decided_at=new_row.decided_at.isoformat() if new_row.decided_at else None,
            supersedes_id=new_row.supersedes_id,
            created_at=new_row.created_at.isoformat(),
        )

    @staticmethod
    async def get_consent_history(
        session: AsyncSession,
        current_user: User,
        student_id: str,
    ) -> List[ConsentLedgerItem]:
        stmt = (
            select(ConsentLedger)
            .where(ConsentLedger.student_id == student_id)
            .order_by(desc(ConsentLedger.created_at))
        )
        res = await session.execute(stmt)
        rows = res.scalars().all()

        return [
            ConsentLedgerItem(
                id=r.id,
                student_id=r.student_id,
                proposal_type=r.proposal_type,
                proposal_payload=r.proposal_payload,
                proposed_by_agent=r.proposed_by_agent,
                priority_class=r.priority_class,
                status=r.status,
                decided_by=r.decided_by,
                decided_at=r.decided_at.isoformat() if r.decided_at else None,
                supersedes_id=r.supersedes_id,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ]

    @staticmethod
    async def get_student_preferences(
        session: AsyncSession,
        current_user: User,
        student_id: str,
    ) -> List[StudentPreferenceResponse]:
        stmt = select(StudentPreference).where(StudentPreference.student_id == student_id)
        res = await session.execute(stmt)
        prefs = res.scalars().all()

        return [
            StudentPreferenceResponse(
                key=p.key,
                value=p.value,
                updated_at=p.updated_at.isoformat(),
            )
            for p in prefs
        ]

    @staticmethod
    async def revoke_preference(
        session: AsyncSession,
        current_user: User,
        student_id: str,
        preference_key: str,
        decided_by: str = "student",
    ) -> ConsentLedgerItem:
        # Check active preference
        stmt = select(StudentPreference).where(
            and_(
                StudentPreference.student_id == student_id,
                StudentPreference.key == preference_key,
            )
        )
        res = await session.execute(stmt)
        pref = res.scalar_one_or_none()
        if not pref:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Active preference '{preference_key}' not found.",
            )

        # Find the latest approved ledger row for this key to link supersedes_id
        ledger_stmt = (
            select(ConsentLedger)
            .where(
                and_(
                    ConsentLedger.student_id == student_id,
                    ConsentLedger.proposal_type == preference_key,
                    ConsentLedger.status == "approved",
                )
            )
            .order_by(desc(ConsentLedger.created_at))
            .limit(1)
        )
        ledger_res = await session.execute(ledger_stmt)
        prev_approved = ledger_res.scalar_one_or_none()

        # Delete active preference from student_preferences
        await session.delete(pref)

        # Append revocation row to ConsentLedger (append-only guarantee)
        revocation_row = ConsentLedger(
            student_id=student_id,
            proposal_type=preference_key,
            proposal_payload={"revoked": True, "prior_payload": pref.value},
            proposed_by_agent="consent_trust",
            priority_class="consent",
            status="declined",
            decided_by=decided_by,
            decided_at=utc_now(),
            supersedes_id=prev_approved.id if prev_approved else None,
        )
        session.add(revocation_row)

        # Update trust profile
        tp_stmt = select(TrustProfile).where(TrustProfile.student_id == student_id)
        tp_res = await session.execute(tp_stmt)
        tp = tp_res.scalar_one_or_none()
        if tp:
            tp.declined_count += 1
            tp.last_updated = utc_now()

        await session.commit()
        await session.refresh(revocation_row)

        return ConsentLedgerItem(
            id=revocation_row.id,
            student_id=revocation_row.student_id,
            proposal_type=revocation_row.proposal_type,
            proposal_payload=revocation_row.proposal_payload,
            proposed_by_agent=revocation_row.proposed_by_agent,
            priority_class=revocation_row.priority_class,
            status=revocation_row.status,
            decided_by=revocation_row.decided_by,
            decided_at=revocation_row.decided_at.isoformat() if revocation_row.decided_at else None,
            supersedes_id=revocation_row.supersedes_id,
            created_at=revocation_row.created_at.isoformat(),
        )

    @staticmethod
    async def get_trust_profile(
        session: AsyncSession,
        current_user: User,
        student_id: str,
    ) -> TrustProfileResponse:
        stmt = select(TrustProfile).where(TrustProfile.student_id == student_id)
        res = await session.execute(stmt)
        tp = res.scalar_one_or_none()
        if not tp:
            tp = TrustProfile(student_id=student_id, accepted_count=0, declined_count=0)
            session.add(tp)
            await session.commit()
            await session.refresh(tp)

        rate, factor, _ = ConsentTrustAgent.compute_trust_metrics(tp.accepted_count, tp.declined_count)

        return TrustProfileResponse(
            student_id=tp.student_id,
            accepted_count=tp.accepted_count,
            declined_count=tp.declined_count,
            total_decisions=tp.accepted_count + tp.declined_count,
            acceptance_rate=rate,
            nagging_reduction_factor=factor,
            last_updated=tp.last_updated.isoformat(),
        )
