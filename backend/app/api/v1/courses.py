from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_teacher
from app.schemas.course import (
    CourseCreateRequest,
    CourseUpdateRequest,
    CourseResponse,
    CourseDetailResponse,
    ChapterCreateRequest,
    ChapterResponse,
    TopicCreateRequest,
    TopicResponse,
    LectureCreateRequest,
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
    )


@router.get("/courses/{id}", response_model=CourseDetailResponse)
async def get_course(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves full details of a course including chapters, topics, and lectures."""
    return await CourseService.get_course_detail(session, id)


@router.patch("/courses/{id}", response_model=CourseResponse)
async def update_course(
    id: str,
    req: CourseUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates a course title, description, or published state (Teacher owner only)."""
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


@router.get("/chapters/{id}/lectures", response_model=List[LectureResponse])
async def list_chapter_lectures(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves all lectures and video playback URLs for a chapter."""
    return await CourseService.list_chapter_lectures(session, id)
