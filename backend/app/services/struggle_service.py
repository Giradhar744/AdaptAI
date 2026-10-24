from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student, DisabilityProfile
from app.db.models.adaptation import BehaviourSignal, StruggleAssessment
from app.db.models.practice import DPPSession, DPPResponse
from app.schemas.struggle import (
    BehaviourSignalCreate,
    BehaviourSignalResponse,
    StruggleAssessmentResponse,
    ProposalSummary,
)
from app.ml.features import extract_behavioural_features
from app.ml.struggle_model import StruggleModel
from app.llm.decision_layer import RequestContext, Decision
from app.mcp.router import MCPRouter
from app.engine.priority_engine import PriorityEngine
from app.engine.consent_ledger import ConsentLedgerEngine


class StruggleService:

    @staticmethod
    async def record_signals_batch(
        session: AsyncSession,
        student_id: str,
        signals: List[BehaviourSignalCreate],
    ) -> List[BehaviourSignalResponse]:
        created_records = []
        for s in signals:
            row = BehaviourSignal(
                student_id=student_id,
                session_ref=s.session_ref,
                signal_type=s.signal_type,
                value=s.value,
                recorded_at=utc_now(),
            )
            session.add(row)
            created_records.append(row)

        await session.commit()
        for r in created_records:
            await session.refresh(r)

        return [
            BehaviourSignalResponse(
                id=r.id,
                student_id=r.student_id,
                session_ref=r.session_ref,
                signal_type=r.signal_type,
                value=r.value,
                recorded_at=r.recorded_at.isoformat(),
            )
            for r in created_records
        ]

    @staticmethod
    async def assess_struggle(
        session: AsyncSession,
        current_user: User,
        session_ref: str,
        extra_signals: Optional[List[BehaviourSignalCreate]] = None,
    ) -> StruggleAssessmentResponse:
        if not current_user.student_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only students can have struggle assessments evaluated.",
            )

        student = current_user.student_profile
        student_id = student.id

        # 1. Ingest any extra real-time signals supplied in the assessment payload
        if extra_signals:
            for s in extra_signals:
                session.add(
                    BehaviourSignal(
                        student_id=student_id,
                        session_ref=s.session_ref,
                        signal_type=s.signal_type,
                        value=s.value,
                        recorded_at=utc_now(),
                    )
                )
            await session.commit()

        # 2. Fetch rolling window of behavioural signals for this session
        sig_stmt = (
            select(BehaviourSignal)
            .where(
                BehaviourSignal.student_id == student_id,
                BehaviourSignal.session_ref == session_ref,
            )
            .order_by(desc(BehaviourSignal.recorded_at))
            .limit(20)
        )
        sig_res = await session.execute(sig_stmt)
        signals_rows = list(reversed(sig_res.scalars().all()))

        signals_data = [
            {"signal_type": s.signal_type, "value": s.value, "recorded_at": s.recorded_at}
            for s in signals_rows
        ]

        # 3. Fetch recent practice responses if session_ref refers to a DPPSession
        resp_stmt = (
            select(DPPResponse)
            .where(DPPResponse.dpp_session_id == session_ref)
            .order_by(desc(DPPResponse.created_at))
            .limit(10)
        )
        resp_res = await session.execute(resp_stmt)
        resp_rows = list(reversed(resp_res.scalars().all()))

        responses_data = [
            {
                "question_id": r.question_id,
                "is_correct": r.is_correct,
                "time_taken_ms": r.time_taken_ms,
                "hints_used": r.hints_used,
            }
            for r in resp_rows
        ]

        # 4. Extract behavioural features over rolling window
        features = extract_behavioural_features(signals_data, responses_data)

        # 5. Predict struggle score, risk level, contributing factors
        score, risk_level, contributing_factors = StruggleModel.predict(features)

        # 6. Save StruggleAssessment record to database
        assessment = StruggleAssessment(
            student_id=student_id,
            score=score,
            risk_level=risk_level,
            features=features,
            model_version=StruggleModel.VERSION,
        )
        session.add(assessment)
        await session.commit()
        await session.refresh(assessment)

        # 7. Fetch full student profile for MCP RequestContext
        student_res = await session.execute(
            select(Student)
            .where(Student.id == student_id)
            .options(
                selectinload(Student.disabilities).selectinload(DisabilityProfile.disability_type),
                selectinload(Student.age_band),
            )
        )
        full_student = student_res.scalar_one()
        disability_codes = [d.disability_type.code for d in full_student.disabilities if d.disability_type]

        ctx = RequestContext(
            user_id=current_user.id,
            role="student",
            student_id=student_id,
            disability_types=disability_codes,
            age_band=full_student.age_band.code if full_student.age_band else "11-15",
            recent_signals_summary=features,
        )

        decision = Decision(intent="assess_struggle")
        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "features": features,
                "risk_level": risk_level,
                "struggle_score": score,
                "contributing_factors": contributing_factors,
            },
        )

        # Aggregate proposals from agents
        raw_proposals = []
        for r in agent_responses:
            if r.status == "success":
                raw_proposals.extend(r.proposals)

        # 8. Reconcile proposals through PriorityEngine (safety > student consent > pedagogy > nudges)
        cooldown_types = await ConsentLedgerEngine.get_active_cooldown_types(session, student_id)
        filtered_proposals = PriorityEngine.resolve(raw_proposals, cooldown_types)

        # Record proposals into append-only Consent Ledger
        active_pendings = await ConsentLedgerEngine.get_pending_proposals(session, student_id)
        active_pending_types = {ap.proposal_type for ap in active_pendings}

        for p in filtered_proposals:
            if p.requires_consent:
                if p.type not in active_pending_types:
                    await ConsentLedgerEngine.record_pending_proposal(session, student_id, p)
                    active_pending_types.add(p.type)
            elif p.priority_class == "safety":
                await ConsentLedgerEngine.record_auto_applied_proposal(session, student_id, p)

        proposal_summaries = [
            ProposalSummary(
                agent=p.agent,
                type=p.type,
                priority_class=p.priority_class,
                payload=p.payload,
                requires_consent=p.requires_consent,
                rationale=p.rationale,
                confidence=p.confidence,
            )
            for p in filtered_proposals
        ]

        return StruggleAssessmentResponse(
            id=assessment.id,
            student_id=student_id,
            score=score,
            risk_level=risk_level,
            features=features,
            contributing_factors=contributing_factors,
            proposals=proposal_summaries,
            model_version=assessment.model_version,
            recorded_at=assessment.created_at.isoformat(),
        )

    @staticmethod
    async def get_struggle_history(
        session: AsyncSession,
        student_id: str,
        limit: int = 10,
    ) -> List[StruggleAssessmentResponse]:
        stmt = (
            select(StruggleAssessment)
            .where(StruggleAssessment.student_id == student_id)
            .order_by(desc(StruggleAssessment.created_at))
            .limit(limit)
        )
        res = await session.execute(stmt)
        assessments = res.scalars().all()

        return [
            StruggleAssessmentResponse(
                id=a.id,
                student_id=a.student_id,
                score=a.score,
                risk_level=a.risk_level,
                features=a.features,
                contributing_factors=[],
                proposals=[],
                model_version=a.model_version,
                recorded_at=a.created_at.isoformat(),
            )
            for a in assessments
        ]
