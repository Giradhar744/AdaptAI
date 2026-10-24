from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models.identity import Teacher, User
from app.db.models.content import Course, Chapter, Topic, Lecture
from app.db.models.reference import AgeBand
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
from app.video.factory import get_video_store


class CourseService:

    @staticmethod
    async def create_course(
        session: AsyncSession,
        teacher_user: User,
        req: CourseCreateRequest,
    ) -> CourseResponse:
        if not teacher_user.teacher_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User does not have an active teacher profile.",
            )

        # Resolve AgeBand by code
        res = await session.execute(select(AgeBand).where(AgeBand.code == req.age_band_code))
        age_band = res.scalar_one_or_none()
        if not age_band:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Age band '{req.age_band_code}' not found.",
            )

        course = Course(
            teacher_id=teacher_user.teacher_profile.id,
            title=req.title,
            subject=req.subject,
            age_band_id=age_band.id,
            description=req.description,
            is_published=False,
        )
        session.add(course)
        await session.commit()
        await session.refresh(course)

        return CourseResponse(
            id=course.id,
            teacher_id=teacher_user.teacher_profile.id,
            teacher_name=teacher_user.teacher_profile.display_name,
            title=course.title,
            subject=course.subject,
            age_band_id=age_band.id,
            age_band_code=age_band.code,
            age_band_label=age_band.label,
            description=course.description,
            is_published=course.is_published,
            chapters_count=0,
        )

    @staticmethod
    async def list_courses(
        session: AsyncSession,
        teacher_id: Optional[str] = None,
        age_band_code: Optional[str] = None,
        only_published: bool = True,
    ) -> List[CourseResponse]:
        stmt = (
            select(Course)
            .options(
                selectinload(Course.teacher),
                selectinload(Course.age_band),
                selectinload(Course.chapters),
            )
        )

        if teacher_id:
            stmt = stmt.where(Course.teacher_id == teacher_id)
        elif only_published:
            stmt = stmt.where(Course.is_published.is_(True))

        if age_band_code:
            stmt = stmt.join(AgeBand).where(AgeBand.code == age_band_code)

        result = await session.execute(stmt)
        courses = result.scalars().all()

        return [
            CourseResponse(
                id=c.id,
                teacher_id=c.teacher_id,
                teacher_name=c.teacher.display_name if c.teacher else "Unknown",
                title=c.title,
                subject=c.subject,
                age_band_id=c.age_band_id,
                age_band_code=c.age_band.code if c.age_band else "",
                age_band_label=c.age_band.label if c.age_band else "",
                description=c.description,
                is_published=c.is_published,
                chapters_count=len(c.chapters),
            )
            for c in courses
        ]

    @staticmethod
    async def get_course_detail(session: AsyncSession, course_id: str) -> CourseDetailResponse:
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.teacher),
                selectinload(Course.age_band),
                selectinload(Course.chapters)
                .selectinload(Chapter.topics),
                selectinload(Course.chapters)
                .selectinload(Chapter.lectures),
            )
        )
        result = await session.execute(stmt)
        course = result.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        video_store = get_video_store()

        chapters_response: List[ChapterResponse] = []
        for ch in course.chapters:
            topics_resp = [
                TopicResponse(
                    id=t.id,
                    chapter_id=t.chapter_id,
                    title=t.title,
                    position=t.position,
                    content_text=t.content_text,
                )
                for t in ch.topics
            ]
            lectures_resp = [
                LectureResponse(
                    id=l.id,
                    chapter_id=l.chapter_id,
                    title=l.title,
                    video_ref=l.video_ref,
                    playback_url=video_store.playback_ref(l.video_ref),
                    duration_seconds=l.duration_seconds,
                )
                for l in ch.lectures
            ]
            chapters_response.append(
                ChapterResponse(
                    id=ch.id,
                    course_id=ch.course_id,
                    title=ch.title,
                    position=ch.position,
                    topics=topics_resp,
                    lectures=lectures_resp,
                )
            )

        return CourseDetailResponse(
            id=course.id,
            teacher_id=course.teacher_id,
            teacher_name=course.teacher.display_name if course.teacher else "Unknown",
            title=course.title,
            subject=course.subject,
            age_band_id=course.age_band_id,
            age_band_code=course.age_band.code if course.age_band else "",
            age_band_label=course.age_band.label if course.age_band else "",
            description=course.description,
            is_published=course.is_published,
            chapters_count=len(course.chapters),
            chapters=chapters_response,
        )

    @staticmethod
    async def update_course(
        session: AsyncSession,
        course_id: str,
        teacher_user: User,
        req: CourseUpdateRequest,
    ) -> CourseResponse:
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.teacher),
                selectinload(Course.age_band),
                selectinload(Course.chapters),
            )
        )
        res = await session.execute(stmt)
        course = res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        # Ownership verification
        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        if req.title is not None:
            course.title = req.title
        if req.subject is not None:
            course.subject = req.subject
        if req.description is not None:
            course.description = req.description
        if req.is_published is not None:
            course.is_published = req.is_published

        await session.commit()
        await session.refresh(course)

        return CourseResponse(
            id=course.id,
            teacher_id=course.teacher_id,
            teacher_name=course.teacher.display_name if course.teacher else "Unknown",
            title=course.title,
            subject=course.subject,
            age_band_id=course.age_band_id,
            age_band_code=course.age_band.code if course.age_band else "",
            age_band_label=course.age_band.label if course.age_band else "",
            description=course.description,
            is_published=course.is_published,
            chapters_count=len(course.chapters),
        )

    @staticmethod
    async def add_chapter(
        session: AsyncSession,
        course_id: str,
        teacher_user: User,
        req: ChapterCreateRequest,
    ) -> ChapterResponse:
        res = await session.execute(select(Course).where(Course.id == course_id))
        course = res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        # Determine position if not explicitly supplied
        position = req.position
        if position is None:
            count_res = await session.execute(
                select(func.count(Chapter.id)).where(Chapter.course_id == course_id)
            )
            position = count_res.scalar() + 1

        chapter = Chapter(course_id=course_id, title=req.title, position=position)
        session.add(chapter)
        await session.commit()
        await session.refresh(chapter)

        return ChapterResponse(
            id=chapter.id,
            course_id=chapter.course_id,
            title=chapter.title,
            position=chapter.position,
            topics=[],
            lectures=[],
        )

    @staticmethod
    async def add_topic(
        session: AsyncSession,
        chapter_id: str,
        teacher_user: User,
        req: TopicCreateRequest,
    ) -> TopicResponse:
        stmt = (
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        if not teacher_user.teacher_profile or chapter.course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        position = req.position
        if position is None:
            count_res = await session.execute(
                select(func.count(Topic.id)).where(Topic.chapter_id == chapter_id)
            )
            position = count_res.scalar() + 1

        topic = Topic(
            chapter_id=chapter_id,
            title=req.title,
            position=position,
            content_text=req.content_text,
        )
        session.add(topic)
        await session.commit()
        await session.refresh(topic)

        return TopicResponse(
            id=topic.id,
            chapter_id=topic.chapter_id,
            title=topic.title,
            position=topic.position,
            content_text=topic.content_text,
        )

    @staticmethod
    async def get_lecture_upload_url(
        session: AsyncSession,
        chapter_id: str,
        teacher_user: User,
        req: LectureUploadUrlRequest,
    ) -> UploadUrlResponse:
        stmt = (
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        if not teacher_user.teacher_profile or chapter.course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        video_store = get_video_store()
        target = await video_store.create_upload(req.filename, req.content_type)

        return UploadUrlResponse(
            upload_url=target.upload_url,
            video_id=target.video_id,
            content_type=target.content_type,
        )

    @staticmethod
    async def add_lecture(
        session: AsyncSession,
        teacher_user: User,
        req: LectureCreateRequest,
    ) -> LectureResponse:
        stmt = (
            select(Chapter)
            .where(Chapter.id == req.chapter_id)
            .options(selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        if not teacher_user.teacher_profile or chapter.course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        lecture = Lecture(
            chapter_id=req.chapter_id,
            title=req.title,
            video_ref=req.video_ref,
            duration_seconds=req.duration_seconds,
        )
        session.add(lecture)
        await session.commit()
        await session.refresh(lecture)

        video_store = get_video_store()
        return LectureResponse(
            id=lecture.id,
            chapter_id=lecture.chapter_id,
            title=lecture.title,
            video_ref=lecture.video_ref,
            playback_url=video_store.playback_ref(lecture.video_ref),
            duration_seconds=lecture.duration_seconds,
        )

    @staticmethod
    async def list_chapter_lectures(session: AsyncSession, chapter_id: str) -> List[LectureResponse]:
        res = await session.execute(select(Lecture).where(Lecture.chapter_id == chapter_id))
        lectures = res.scalars().all()
        video_store = get_video_store()
        return [
            LectureResponse(
                id=l.id,
                chapter_id=l.chapter_id,
                title=l.title,
                video_ref=l.video_ref,
                playback_url=video_store.playback_ref(l.video_ref),
                duration_seconds=l.duration_seconds,
            )
            for l in lectures
        ]
