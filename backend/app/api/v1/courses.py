from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_teacher, require_student
from app.schemas.course import (
    CourseCreateRequest,
    CourseUpdateRequest,
    CourseResponse,
    CourseDetailResponse,
    ChapterCreateRequest,
    ChapterUpdateRequest,
    ChapterResponse,
    TopicCreateRequest,
    TopicResponse,
    LectureCreateRequest,
    LectureUpdateRequest,
    LectureResponse,
    LectureUploadUrlRequest,
    UploadUrlResponse,
)
from app.services.course_service import CourseService

router = APIRouter(tags=["Courses & Content"])


# 1. Course Endpoints
@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    req: CourseCreateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Creates a new course authored by the authenticated teacher."""
    return await CourseService.create_course(session, current_teacher, req)


@router.get("/courses", response_model=List[CourseResponse])
async def list_courses(
    mine: bool = Query(default=False, description="If true, returns only courses authored by current teacher"),
    age_band_code: Optional[str] = Query(default=None, description="Filter courses by age band: 7-10, 11-15, 15-20"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Lists courses. If mine=true and user is teacher, lists their authored courses."""
    teacher_id = None
    if mine and current_user.role == "teacher" and current_user.teacher_profile:
        teacher_id = current_user.teacher_profile.id

    return await CourseService.list_courses(
        session,
        teacher_id=teacher_id,
        age_band_code=age_band_code,
        only_published=not mine,
        current_user=current_user,
    )


@router.get("/courses/{id}", response_model=CourseDetailResponse)
async def get_course(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves full details of a course. Video playback URLs are protected and require enrolment."""
    return await CourseService.get_course_detail(session, id, current_user=current_user)


@router.patch("/courses/{id}", response_model=CourseResponse)
async def update_course(
    id: str,
    req: CourseUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates a course title, description, fee, or published state (Teacher owner only)."""
    return await CourseService.update_course(session, id, current_teacher, req)


# 2. Chapter Endpoints
@router.post("/courses/{id}/chapters", response_model=ChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_chapter(
    id: str,
    req: ChapterCreateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Adds a new chapter to an existing course (Teacher owner only)."""
    return await CourseService.add_chapter(session, id, current_teacher, req)


@router.patch("/chapters/{id}", response_model=ChapterResponse)
async def update_chapter(
    id: str,
    req: ChapterUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates chapter title or position (Teacher owner only)."""
    return await CourseService.update_chapter(session, id, current_teacher, req)


@router.delete("/chapters/{id}")
async def delete_chapter(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Deletes a chapter with safe cascade (Teacher owner only)."""
    return await CourseService.delete_chapter(session, id, current_teacher)


# 3. Topic Endpoints
@router.post("/chapters/{id}/topics", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    id: str,
    req: TopicCreateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Adds a topic to a chapter with source content text for DPP generation (Teacher owner only)."""
    return await CourseService.add_topic(session, id, current_teacher, req)


# 4. Lecture & Video Endpoints
@router.post("/chapters/{id}/lectures/upload-url", response_model=UploadUrlResponse)
async def get_lecture_upload_url(
    id: str,
    req: LectureUploadUrlRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Generates a pre-signed or mock upload URL from the VideoStore (Teacher owner only)."""
    return await CourseService.get_lecture_upload_url(session, id, current_teacher, req)


@router.post("/lectures", response_model=LectureResponse, status_code=status.HTTP_201_CREATED)
async def create_lecture(
    req: LectureCreateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Associates an uploaded video reference with a chapter as a lecture (Teacher owner only)."""
    return await CourseService.add_lecture(session, current_teacher, req)


@router.patch("/lectures/{id}", response_model=LectureResponse)
async def update_lecture(
    id: str,
    req: LectureUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates lecture details or video reference (Teacher owner only)."""
    return await CourseService.update_lecture(session, id, current_teacher, req)


@router.delete("/lectures/{id}")
async def delete_lecture(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Deletes a lecture (Teacher owner only)."""
    return await CourseService.delete_lecture(session, id, current_teacher)


@router.get("/chapters/{id}/lectures", response_model=List[LectureResponse])
async def list_chapter_lectures(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves all lectures for a chapter. Video playback URLs are provided to enrolled students only."""
    return await CourseService.list_chapter_lectures(session, id, current_user=current_user)


# 5. Student Learning Progress Endpoints
@router.post("/chapters/{id}/lectures/complete")
async def mark_lecture_completed(
    id: str,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Marks a chapter lecture complete and unlocks its Daily Practice (DPP)."""
    return await CourseService.mark_lecture_completed(session, id, current_student)


@router.post("/chapters/{id}/dpp/complete")
async def mark_dpp_completed(
    id: str,
    current_student: User = Depends(require_student),
    session: AsyncSession = Depends(get_db),
):
    """Marks a chapter DPP complete and unlocks the chapter assessment test."""
    return await CourseService.mark_dpp_completed(session, id, current_student)
