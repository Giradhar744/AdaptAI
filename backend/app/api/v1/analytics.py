from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_teacher
from app.schemas.test_and_analytics import (
    CourseRatingResponse,
    CourseAnalyticsResponse,
)
from app.services.teacher_service import TeacherAnalyticsService

router = APIRouter(tags=["Teacher Analytics & Ratings"])


@router.get("/courses/{id}/rating", response_model=CourseRatingResponse)
async def get_course_star_rating(
    id: str,
    session: AsyncSession = Depends(get_db),
):
    """
    Retrieves the course star rating (1.0 to 5.0) computed strictly from students' first-attempt results.
    Enforces minimum first-attempts threshold before publishing.
    """
    return await TeacherAnalyticsService.get_course_rating(session=session, course_id=id)


@router.get("/courses/{id}/analytics", response_model=CourseAnalyticsResponse)
async def get_course_analytics(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """
    Retrieves comprehensive educator dashboard analytics for a course:
    first-attempt vs re-attempt counts, struggle alerts, star rating, and AI Co-Pilot narrative synthesis.
    """
    return await TeacherAnalyticsService.get_course_analytics(
        session=session,
        current_user=current_teacher,
        course_id=id,
    )
