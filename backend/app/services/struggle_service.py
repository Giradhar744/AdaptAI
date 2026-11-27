import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student
from app.db.models.practice import DPPSession, DPPResponse
from app.schemas.struggle import (
    BehaviourSignalCreate,
    BehaviourSignalResponse,
    StruggleAssessmentResponse,
    ProposalSummary,
)
from app.ml.features import extract_behavioural_features
from app.ml.struggle_model import StruggleModel


class StruggleService:

    @staticmethod
    async def record_signals_batch(
        session: AsyncSession,
        student_id: str,
        signals: List[BehaviourSignalCreate],
    ) -> List[BehaviourSignalResponse]:
        now = utc_now()
        return [
            BehaviourSignalResponse(
                id=str(uuid.uuid4()),
                student_id=student_id,
                session_ref=s.session_ref,
                signal_type=s.signal_type,
                value=s.value,
                recorded_at=now,
            )
            for s in signals
        ]

    @staticmethod
    async def assess_struggle(
        session: AsyncSession,
        student_id: str,
        session_ref: str,
        current_user: User,
        extra_signals: Optional[List[BehaviourSignalCreate]] = None,
    ) -> StruggleAssessmentResponse:
        # Guard: must be own student or parent
        if current_user.role == "student" and (not current_user.student_profile or current_user.student_profile.id != student_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assess other student struggle.")
        if current_user.role == "parent":
            s_res = await session.execute(select(Student).where(Student.id == student_id))
            student = s_res.scalar_one_or_none()
            if not student or student.parent_user_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other student struggle.")

        signals_data = []
        if extra_signals:
            for s in extra_signals:
                signals_data.append({"signal_type": s.signal_type, "value": s.value, "recorded_at": utc_now()})

        # Fetch recent practice responses if session_ref refers to a DPPSession
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

        features = extract_behavioural_features(signals_data, responses_data)
        score, risk_level, contributing_factors = StruggleModel.predict(features)
        now_dt = utc_now()

        return StruggleAssessmentResponse(
            id=str(uuid.uuid4()),
            student_id=student_id,
            score=score,
            risk_level=risk_level,
            features=features,
            contributing_factors=contributing_factors,
            proposals=[],
            model_version=StruggleModel.VERSION,
            recorded_at=now_dt.isoformat(),
        )

    @staticmethod
    async def get_struggle_history(
        session: AsyncSession,
        student_id: str,
        limit: int = 10,
    ) -> List[StruggleAssessmentResponse]:
        return []
