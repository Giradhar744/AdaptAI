from typing import List, Optional
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models.identity import Teacher, User, Student
from app.db.models.content import Course, Chapter, Topic, Lecture
from app.db.models.practice import DPP, ChapterTest
from app.db.models.progress import Enrolment, ChapterProgress
from app.db.models.reference import AgeBand
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
            fee=req.fee,
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
            fee=course.fee,
            is_published=course.is_published,
            chapters_count=0,
            is_enrolled=True,
        )

    @staticmethod
    async def list_courses(
        session: AsyncSession,
        teacher_id: Optional[str] = None,
        age_band_code: Optional[str] = None,
        only_published: bool = True,
        current_user: Optional[User] = None,
    ) -> List[CourseResponse]:
        stmt = (
            select(Course)
            .options(
                joinedload(Course.teacher),
                joinedload(Course.age_band),
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

        # Check enrolments for current user if student
        enrolled_course_ids = set()
        if current_user and current_user.student_profile:
            enr_stmt = select(Enrolment.course_id).where(
                and_(
                    Enrolment.student_id == current_user.student_profile.id,
                    Enrolment.status == "active",
                )
            )
            enr_res = await session.execute(enr_stmt)
            enrolled_course_ids = set(enr_res.scalars().all())

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
                fee=getattr(c, "fee", 0.0),
                is_published=c.is_published,
                chapters_count=len(c.chapters),
                is_enrolled=bool(
                    c.id in enrolled_course_ids or
                    bool(current_user and current_user.teacher_profile and current_user.teacher_profile.id == c.teacher_id)
                ),
            )
            for c in courses
        ]

    @staticmethod
    async def get_course_detail(
        session: AsyncSession,
        course_id: str,
        current_user: Optional[User] = None,
    ) -> CourseDetailResponse:
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                joinedload(Course.teacher),
                joinedload(Course.age_band),
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

        # Access check: enrolled student or teacher owner
        is_owner = (
            current_user is not None and
            current_user.teacher_profile is not None and
            course.teacher_id == current_user.teacher_profile.id
        )

        is_enrolled = is_owner or getattr(course, "fee", 0.0) == 0.0
        student_id: Optional[str] = None
        if current_user and current_user.student_profile:
            student_id = current_user.student_profile.id
            enr_stmt = select(Enrolment.course_id).where(
                and_(
                    Enrolment.student_id == student_id,
                    Enrolment.course_id == course_id,
                    Enrolment.status == "active",
                )
            )
            enr_res = await session.execute(enr_stmt)
            if enr_res.scalar_one_or_none() is not None:
                is_enrolled = True

        video_store = get_video_store()

        # Query all chapter tests for these chapters in one batch
        chapter_ids = [ch.id for ch in course.chapters]
        tests_by_chapter = {}
        if chapter_ids:
            tests_res = await session.execute(
                select(ChapterTest.id, ChapterTest.chapter_id).where(ChapterTest.chapter_id.in_(chapter_ids))
            )
            for t_id, ch_id in tests_res.all():
                tests_by_chapter[ch_id] = t_id

        # Query only DPPs specifically belonging to topics or lectures in this course
        dpps_by_topic = {}
        dpps_by_lecture = {}
        if chapter_ids:
            lecture_ids = [l.id for ch in course.chapters for l in ch.lectures]
            topic_ids = [t.id for ch in course.chapters for t in ch.topics]
            dpp_conditions = []
            if lecture_ids:
                dpp_conditions.append(DPP.lecture_id.in_(lecture_ids))
            if topic_ids:
                dpp_conditions.append(DPP.topic_id.in_(topic_ids))

            if dpp_conditions:
                dpps_res = await session.execute(
                    select(DPP.id, DPP.lecture_id, DPP.topic_id).where(or_(*dpp_conditions))
                )
                for dpp_id, dpp_lec_id, dpp_top_id in dpps_res.all():
                    if dpp_top_id:
                        dpps_by_topic[dpp_top_id] = dpp_id
                    if dpp_lec_id:
                        dpps_by_lecture[dpp_lec_id] = dpp_id

        # Query student progress for each chapter if student
        progress_by_chapter = {}
        if student_id and chapter_ids:
            prog_res = await session.execute(
                select(ChapterProgress).where(
                    and_(
                        ChapterProgress.student_id == student_id,
                        ChapterProgress.chapter_id.in_(chapter_ids),
                    )
                )
            )
            for p in prog_res.scalars().all():
                progress_by_chapter[p.chapter_id] = p

        chapters_response: List[ChapterResponse] = []
        for ch in course.chapters:
            ch_prog = progress_by_chapter.get(ch.id)
            ch_lecture_done = ch_prog.lecture_completed if ch_prog else False
            ch_dpp_done = ch_prog.dpp_completed if ch_prog else False
            ch_test_unlocked = ch_prog.test_unlocked if ch_prog else False

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
                    # Access barrier: hide stream URL if student is not enrolled
                    playback_url=video_store.playback_ref(l.video_ref) if is_enrolled else None,
                    duration_seconds=l.duration_seconds,
                    dpp_id=dpps_by_lecture.get(l.id) or (dpps_by_topic.get(ch.topics[0].id) if ch.topics else None),
                    is_completed=ch_lecture_done,
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
                    dpp_completed=ch_dpp_done,
                    test_unlocked=ch_test_unlocked or is_owner,
                    chapter_test_id=tests_by_chapter.get(ch.id),
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
            fee=getattr(course, "fee", 0.0),
            is_published=course.is_published,
            chapters_count=len(course.chapters),
            chapters=chapters_response,
            is_enrolled=is_enrolled,
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
        if req.fee is not None:
            course.fee = req.fee
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
            fee=getattr(course, "fee", 0.0),
            is_published=course.is_published,
            chapters_count=len(course.chapters),
            is_enrolled=True,
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

        if teacher_user.role != "admin":
            if teacher_user.teacher_profile and course.teacher_id is None:
                course.teacher_id = teacher_user.teacher_profile.id
            elif not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        position = req.position
        if position is None:
            count_res = await session.execute(
                select(func.count(Chapter.id)).where(Chapter.course_id == course_id)
            )
            position = (count_res.scalar() or 0) + 1

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
    async def update_chapter(
        session: AsyncSession,
        chapter_id: str,
        teacher_user: User,
        req: ChapterUpdateRequest,
    ) -> ChapterResponse:
        stmt = (
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        course = chapter.course
        if teacher_user.role != "admin":
            if teacher_user.teacher_profile and course.teacher_id is None:
                course.teacher_id = teacher_user.teacher_profile.id
            elif not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        if req.title is not None:
            chapter.title = req.title
        if req.position is not None:
            chapter.position = req.position

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
    async def delete_chapter(
        session: AsyncSession,
        chapter_id: str,
        teacher_user: User,
    ) -> dict:
        stmt = (
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        course = chapter.course
        if teacher_user.role != "admin":
            if teacher_user.teacher_profile and course.teacher_id is None:
                course.teacher_id = teacher_user.teacher_profile.id
            elif not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        await session.delete(chapter)
        await session.commit()
        return {"message": "Chapter deleted successfully."}
        return {"message": "Chapter deleted successfully."}

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
            position = (count_res.scalar() or 0) + 1

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

        course = chapter.course
        if teacher_user.role != "admin":
            if teacher_user.teacher_profile and course.teacher_id is None:
                course.teacher_id = teacher_user.teacher_profile.id
            elif not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
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
    async def update_lecture(
        session: AsyncSession,
        lecture_id: str,
        teacher_user: User,
        req: LectureUpdateRequest,
    ) -> LectureResponse:
        stmt = (
            select(Lecture)
            .where(Lecture.id == lecture_id)
            .options(selectinload(Lecture.chapter).selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        lecture = res.scalar_one_or_none()
        if not lecture:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found.")

        if not teacher_user.teacher_profile or lecture.chapter.course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        if req.title is not None:
            lecture.title = req.title
        if req.video_ref is not None:
            lecture.video_ref = req.video_ref
        if req.duration_seconds is not None:
            lecture.duration_seconds = req.duration_seconds

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
    async def delete_lecture(
        session: AsyncSession,
        lecture_id: str,
        teacher_user: User,
    ) -> dict:
        stmt = (
            select(Lecture)
            .where(Lecture.id == lecture_id)
            .options(selectinload(Lecture.chapter).selectinload(Chapter.course))
        )
        res = await session.execute(stmt)
        lecture = res.scalar_one_or_none()
        if not lecture:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found.")

        course = lecture.chapter.course
        if teacher_user.role != "admin":
            if teacher_user.teacher_profile and course.teacher_id is None:
                course.teacher_id = teacher_user.teacher_profile.id
            elif not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        await session.delete(lecture)
        await session.commit()
        return {"message": "Lecture deleted successfully."}

    @staticmethod
    async def list_chapter_lectures(
        session: AsyncSession,
        chapter_id: str,
        current_user: Optional[User] = None,
    ) -> List[LectureResponse]:
        res = await session.execute(
            select(Lecture)
            .where(Lecture.chapter_id == chapter_id)
            .options(selectinload(Lecture.chapter).selectinload(Chapter.course))
        )
        lectures = res.scalars().all()
        video_store = get_video_store()

        # Check access permission
        is_enrolled = False
        if current_user and lectures:
            course = lectures[0].chapter.course
            if getattr(course, "fee", 0.0) == 0.0:
                is_enrolled = True
            elif current_user.teacher_profile and course.teacher_id == current_user.teacher_profile.id:
                is_enrolled = True
            elif current_user.student_profile:
                enr_res = await session.execute(
                    select(Enrolment).where(
                        and_(
                            Enrolment.student_id == current_user.student_profile.id,
                            Enrolment.course_id == course.id,
                            Enrolment.status == "active",
                        )
                    )
                )
                if enr_res.scalar_one_or_none():
                    is_enrolled = True

        return [
            LectureResponse(
                id=l.id,
                chapter_id=l.chapter_id,
                title=l.title,
                video_ref=l.video_ref,
                playback_url=video_store.playback_ref(l.video_ref) if is_enrolled else None,
                duration_seconds=l.duration_seconds,
            )
            for l in lectures
        ]

    # =========================================================================
    # Student Chapter Learning Progress Tracking
    # =========================================================================
    @staticmethod
    async def mark_lecture_completed(
        session: AsyncSession,
        chapter_id: str,
        student_user: User,
    ) -> dict:
        if not student_user.student_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students track learning progress.")

        student_id = student_user.student_profile.id
        stmt = select(ChapterProgress).where(
            and_(
                ChapterProgress.student_id == student_id,
                ChapterProgress.chapter_id == chapter_id,
            )
        )
        res = await session.execute(stmt)
        progress = res.scalar_one_or_none()

        if not progress:
            progress = ChapterProgress(
                student_id=student_id,
                chapter_id=chapter_id,
                lecture_completed=True,
                dpp_completed=False,
                test_unlocked=False,
            )
            session.add(progress)
        else:
            progress.lecture_completed = True

        await session.commit()
        return {
            "chapter_id": chapter_id,
            "lecture_completed": True,
            "dpp_unlocked": True,
            "test_unlocked": progress.test_unlocked,
        }

    @staticmethod
    async def mark_dpp_completed(
        session: AsyncSession,
        chapter_id: str,
        student_user: User,
    ) -> dict:
        if not student_user.student_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students track learning progress.")

        student_id = student_user.student_profile.id
        stmt = select(ChapterProgress).where(
            and_(
                ChapterProgress.student_id == student_id,
                ChapterProgress.chapter_id == chapter_id,
            )
        )
        res = await session.execute(stmt)
        progress = res.scalar_one_or_none()

        if not progress:
            progress = ChapterProgress(
                student_id=student_id,
                chapter_id=chapter_id,
                lecture_completed=True,
                dpp_completed=True,
                test_unlocked=True,
            )
            session.add(progress)
        else:
            progress.dpp_completed = True
            progress.test_unlocked = True

        await session.commit()
        return {
            "chapter_id": chapter_id,
            "dpp_completed": True,
            "test_unlocked": True,
        }
