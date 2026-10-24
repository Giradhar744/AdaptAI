from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_student
from app.schemas.practice import (
    DPPSessionStartRequest,
    DPPSessionResponse,
    HintRequest,
    HintResponse,
    DPPResponseSubmitRequest,
    DPPResponseResult,
    DPPSessionSummary,
)
from app.services.practice_service import PracticeService

router = APIRouter(tags=["Practice & ZPD Scaffolding"])


@router.post("/dpp/{id}/sessions", response_model=DPPSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_dpp_session(
    id: str,
    req: DPPSessionStartRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Starts a new Daily Practice Problem session in Independent or AI-Guided mode."""
    return await PracticeService.start_dpp_session(session, id, current_student, req.mode)


@router.post("/dpp-sessions/{id}/hint", response_model=HintResponse)
async def request_hint(
    id: str,
    req: HintRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Requests an adaptive ZPD hint in text or synthesized audio format (AI-Guided mode only)."""
    return await PracticeService.request_hint(
        session,
        id,
        current_student,
        req.question_id,
        req.modality,
        req.current_depth,
    )


@router.post("/dpp-sessions/{id}/responses", response_model=DPPResponseResult)
async def submit_dpp_response(
    id: str,
    req: DPPResponseSubmitRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Submits a student's answer to a DPP question, recording response accuracy and hints used."""
    return await PracticeService.submit_response(session, id, current_student, req)


@router.get("/dpp-sessions/{id}/summary", response_model=DPPSessionSummary)
async def get_session_summary(
    id: str,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves performance metrics, score percentage, and total hints used for a practice session."""
    return await PracticeService.get_session_summary(session, id, current_student)
