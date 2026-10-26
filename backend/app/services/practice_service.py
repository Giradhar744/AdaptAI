import json
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student, DisabilityProfile
from app.db.models.practice import DPP, Question, DPPSession, DPPResponse
from app.db.models.adaptation import HintEvent
from app.llm.decision_layer import RequestContext, Decision
from app.mcp.router import MCPRouter
from app.schemas.practice import (
    DPPSessionResponse,
    HintResponse,
    DPPResponseResult,
    DPPResponseSubmitRequest,
    DPPSessionSummary,
)
from app.schemas.content_gen import QuestionSchema, QuestionOption, CorrectAnswer


class PracticeService:

    @staticmethod
    async def start_dpp_session(
        session: AsyncSession,
        dpp_id: str,
        current_user: User,
        mode: str = "independent",
    ) -> DPPSessionResponse:
        if not current_user.student_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students can start DPP sessions.")

        student_id = current_user.student_profile.id

        # Fetch DPP with questions
        res = await session.execute(
            select(DPP)
            .where(DPP.id == dpp_id)
            .options(selectinload(DPP.questions))
        )
        dpp = res.scalar_one_or_none()
        if not dpp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPP not found.")

        dpp_session = DPPSession(
            dpp_id=dpp_id,
            student_id=student_id,
            mode=mode,
            started_at=utc_now(),
        )
        session.add(dpp_session)
        await session.commit()
        await session.refresh(dpp_session)

        questions = [
            QuestionSchema(
                id=q.id,
                prompt=q.prompt,
                question_type=q.question_type,
                options=[QuestionOption(**opt) for opt in q.options],
                correct_answer=CorrectAnswer(**q.correct_answer),
                explanation=q.explanation,
                difficulty=q.difficulty,
            )
            for q in dpp.questions
        ]

        return DPPSessionResponse(
            session_id=dpp_session.id,
            dpp_id=dpp.id,
            student_id=student_id,
            mode=dpp_session.mode,
            started_at=dpp_session.started_at.isoformat(),
            questions=questions,
        )

    @staticmethod
    async def request_hint(
        session: AsyncSession,
        session_id: str,
        current_user: User,
        question_id: str,
        modality: str = "text",
        requested_depth: Optional[str] = "partial_hint",
    ) -> HintResponse:
        if not current_user.student_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students can request hints.")

        student = current_user.student_profile

        # Fetch session
        res = await session.execute(select(DPPSession).where(DPPSession.id == session_id))
        dpp_session = res.scalar_one_or_none()
        if not dpp_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice session not found.")

        # Guard: In independent mode, hints are disabled (PROJECT.md §10.3 & §11 rule 4)
        if dpp_session.mode == "independent":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hints are not available in Independent Practice mode. Switch to AI-Guided mode to receive scaffolding hints.",
            )

        # Fetch Question
        q_res = await session.execute(select(Question).where(Question.id == question_id))
        question = q_res.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

        # Fetch student's disability hint configuration
        disp_res = await session.execute(
            select(Student)
            .where(Student.id == student.id)
            .options(
                selectinload(Student.disabilities).selectinload(DisabilityProfile.disability_type),
                selectinload(Student.age_band),
            )
        )
        full_student = disp_res.scalar_one()

        disability_codes = [d.disability_type.code for d in full_student.disabilities if d.disability_type]
        first_disability = full_student.disabilities[0].disability_type if full_student.disabilities else None
        hint_style_rules = json.dumps(first_disability.hint_style_config) if first_disability else "Provide clear guidance."

        # Record HintEvent (PROJECT.md §6 & §10.3)
        hint_event = HintEvent(
            student_id=student.id,
            question_id=question.id,
            scaffold_level=requested_depth or "partial_hint",
            modality=modality,
            disability_type_id=first_disability.id if first_disability else None,
        )
        session.add(hint_event)
        await session.commit()

        # Build context & route to ZPDHintAgent
        ctx = RequestContext(
            user_id=current_user.id,
            role="student",
            student_id=student.id,
            disability_types=disability_codes,
            age_band=full_student.age_band.code if full_student.age_band else "11-15",
        )
        decision = Decision(intent="request_hint")

        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "question_prompt": question.prompt,
                "options": question.options,
                "scaffold_level": requested_depth or "partial_hint",
                "modality": modality,
                "hint_style_rules": hint_style_rules,
            },
        )

        hint_data = {}
        for r in agent_responses:
            if r.agent_name == "zpd_hint" and r.status == "success":
                hint_data = r.data
                break

        hint_text = hint_data.get("hint_text", "Think about the central principle described in the lesson.")
        scaffold_level = hint_data.get("scaffold_level", requested_depth or "partial_hint")
        audio_base64 = hint_data.get("audio_base64")
        media_type = hint_data.get("media_type")
        audio_duration = hint_data.get("audio_duration")

        if modality == "audio" and not audio_base64:
            try:
                import base64
                from app.speech.factory import get_tts_provider
                tts = get_tts_provider()
                res = await tts.synthesize(hint_text, voice="calm", speed=0.95)
                audio_base64 = base64.b64encode(res.audio_bytes).decode("utf-8")
                media_type = res.media_type
                audio_duration = res.duration_seconds
            except Exception:
                pass

        return HintResponse(
            hint_text=hint_text,
            scaffold_level=scaffold_level,
            modality=modality,
            audio_base64=audio_base64,
            media_type=media_type,
            audio_duration=audio_duration,
            rationale=hint_data.get("rationale", "ZPD scaffolding hint provided."),
        )

    @staticmethod
    async def submit_response(
        session: AsyncSession,
        session_id: str,
        current_user: User,
        req: DPPResponseSubmitRequest,
    ) -> DPPResponseResult:
        res = await session.execute(select(DPPSession).where(DPPSession.id == session_id))
        dpp_session = res.scalar_one_or_none()
        if not dpp_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice session not found.")

        q_res = await session.execute(select(Question).where(Question.id == req.question_id))
        question = q_res.scalar_one_or_none()
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

        correct_key = question.correct_answer.get("key")
        submitted_key = req.answer.get("selected_key")
        is_correct = (submitted_key == correct_key)

        response_row = DPPResponse(
            dpp_session_id=session_id,
            question_id=req.question_id,
            answer=req.answer,
            is_correct=is_correct,
            time_taken_ms=req.time_taken_ms,
            hints_used=req.hints_used,
        )
        session.add(response_row)
        await session.commit()
        await session.refresh(response_row)

        return DPPResponseResult(
            response_id=response_row.id,
            question_id=req.question_id,
            is_correct=is_correct,
            explanation=question.explanation,
            correct_key=correct_key,
            time_taken_ms=req.time_taken_ms,
        )

    @staticmethod
    async def get_session_summary(
        session: AsyncSession,
        session_id: str,
        current_user: User,
    ) -> DPPSessionSummary:
        res = await session.execute(
            select(DPPSession)
            .where(DPPSession.id == session_id)
            .options(selectinload(DPPSession.responses))
        )
        dpp_session = res.scalar_one_or_none()
        if not dpp_session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

        responses = dpp_session.responses
        total = len(responses)
        correct = sum(1 for r in responses if r.is_correct)
        percentage = (correct / total * 100) if total > 0 else 0.0
        total_time = sum(r.time_taken_ms for r in responses)
        total_hints = sum(r.hints_used for r in responses)

        return DPPSessionSummary(
            session_id=session_id,
            mode=dpp_session.mode,
            total_questions=total,
            correct_count=correct,
            score_percentage=round(percentage, 1),
            total_time_ms=total_time,
            total_hints_used=total_hints,
        )
