from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_student_or_parent
from app.schemas.diagnostic import (
    DiagnosticStartResponse,
    DiagnosticSubmitRequest,
    DiagnosticResultResponse,
    EnrolmentResponse,
)
from app.services.diagnostic_service import DiagnosticService

router = APIRouter(tags=["Diagnostic & Onboarding"])


@router.post("/students/{id}/diagnostic/start", response_model=DiagnosticStartResponse, status_code=status.HTTP_201_CREATED)
async def start_diagnostic(
    id: str,
    current_user: User = Depends(require_student_or_parent),
    session: AsyncSession = Depends(get_db),
):
    """Generates and initiates an age-adapted diagnostic onboarding test for a student."""
    return await DiagnosticService.start_diagnostic(session, id, current_user)


@router.post("/diagnostic/{id}/submit", response_model=DiagnosticResultResponse)
async def submit_diagnostic(
    id: str,
    req: DiagnosticSubmitRequest,
    current_user: User = Depends(require_student_or_parent),
    session: AsyncSession = Depends(get_db),
):
    """Submits student answers, evaluates score, and produces course placement recommendation."""
    return await DiagnosticService.submit_diagnostic(session, id, current_user, req)


@router.get("/diagnostic/{id}/recommendation", response_model=DiagnosticResultResponse)
async def get_diagnostic_recommendation(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves placement recommendation details for an existing diagnostic."""
    return await DiagnosticService.get_recommendation(session, id, current_user)


@router.post("/courses/{id}/enrol", response_model=EnrolmentResponse, status_code=status.HTTP_201_CREATED)
async def enrol_course(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Enrolls the authenticated student in a recommended course."""
    return await DiagnosticService.enrol_in_course(session, id, current_user)


@router.get("/students/{id}/enrolments", response_model=List[EnrolmentResponse])
async def get_student_enrolments(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Lists enrolled courses for a student."""
    return await DiagnosticService.get_student_enrolments(session, id, current_user)
