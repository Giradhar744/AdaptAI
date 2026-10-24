from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_student
from app.schemas.test_and_analytics import (
    TestAttemptStartResponse,
    TestSubmitRequest,
    TestAttemptResultResponse,
)
from app.services.test_service import ChapterTestService

router = APIRouter(tags=["Timed Chapter Tests"])


@router.post("/chapter-tests/{id}/attempts", response_model=TestAttemptStartResponse, status_code=status.HTTP_201_CREATED)
async def start_chapter_test_attempt(
    id: str,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """
    Starts a timed chapter test attempt.
    Enforces server start time and automatically tags attempt_number and is_first_attempt flag.
    """
    return await ChapterTestService.start_test_attempt(
        session=session,
        current_user=current_student,
        chapter_test_id=id,
    )


@router.post("/attempts/{id}/submit", response_model=TestAttemptResultResponse)
async def submit_chapter_test_attempt(
    id: str,
    req: TestSubmitRequest,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """
    Submits a student's answers for a chapter test attempt.
    Validates server deadline (started_at + time_limit) and immediately triggers course rating recomputation if is_first_attempt.
    """
    return await ChapterTestService.submit_test_attempt(
        session=session,
        current_user=current_student,
        attempt_id=id,
        req=req,
    )


@router.get("/attempts/{id}", response_model=TestAttemptResultResponse)
async def get_test_attempt_result(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves score, percentage, timing, and question feedback for a test attempt."""
    return await ChapterTestService.get_attempt_result(
        session=session,
        current_user=current_user,
        attempt_id=id,
    )
