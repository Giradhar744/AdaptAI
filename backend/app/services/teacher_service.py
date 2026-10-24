from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student
from app.db.models.content import Course, Chapter
from app.db.models.progress import Enrolment
from app.db.models.practice import ChapterTest, TestAttempt
from app.db.models.adaptation import StruggleAssessment
from app.db.models.rating import CourseRating
from app.agents.teacher_copilot import TeacherCopilotAgent
from app.core.config import settings
from app.schemas.test_and_analytics import (
    CourseRatingResponse,
    StudentProgressItem,
    CourseAnalyticsResponse,
)


class TeacherAnalyticsService:

    @staticmethod
    async def get_course_rating(
        session: AsyncSession,
        course_id: str,
    ) -> CourseRatingResponse:
        # Check course existence
        res = await session.execute(select(Course).where(Course.id == course_id))
        course = res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        # Query all submitted first attempts for any chapter test in this course (PROJECT.md §10.7 & §11 rule 1)
        attempts_stmt = (
            select(TestAttempt)
            .join(ChapterTest, TestAttempt.chapter_test_id == ChapterTest.id)
            .join(Chapter, ChapterTest.chapter_id == Chapter.id)
            .where(
                and_(
                    Chapter.course_id == course_id,
                    TestAttempt.is_first_attempt == True,
                    TestAttempt.submitted_at.isnot(None),
                )
            )
        )
        attempts_res = await session.execute(attempts_stmt)
        first_attempts = attempts_res.scalars().all()

        ratios = [
            (a.score / a.max_score)
            for a in first_attempts
            if a.max_score > 0
        ]

        stars_data = TeacherCopilotAgent.calculate_course_stars(ratios)

        # Update cache in CourseRating
        cr_stmt = select(CourseRating).where(CourseRating.course_id == course_id)
        cr_res = await session.execute(cr_stmt)
        cr = cr_res.scalar_one_or_none()

        rating_value = stars_data.get("rating_value")
        count = stars_data["attempt_count"]

        if not cr:
            cr = CourseRating(
                course_id=course_id,
                rating_value=rating_value or 0.0,
                computed_from_attempt_count=count,
                computed_at=utc_now(),
            )
            session.add(cr)
        else:
            cr.rating_value = rating_value or 0.0
            cr.computed_from_attempt_count = count
            cr.computed_at = utc_now()

        await session.commit()
        await session.refresh(cr)

        return CourseRatingResponse(
            course_id=course_id,
            rating_value=rating_value,
            computed_from_attempt_count=count,
            min_required_attempts=settings.RATING_MIN_ATTEMPTS,
            status=stars_data["status"],
            computed_at=cr.computed_at.isoformat(),
        )

    @staticmethod
    async def get_course_analytics(
        session: AsyncSession,
        current_user: User,
        course_id: str,
    ) -> CourseAnalyticsResponse:
        # 1. Fetch Course
        c_stmt = select(Course).where(Course.id == course_id)
        c_res = await session.execute(c_stmt)
        course = c_res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        # 2. Enrolled students
        enrol_stmt = (
            select(Enrolment)
            .where(Enrolment.course_id == course_id)
            .options(selectinload(Enrolment.student).selectinload(Student.user))
        )
        enrol_res = await session.execute(enrol_stmt)
        enrolments = enrol_res.scalars().all()
        enrolled_count = len(enrolments)

        # 3. Chapter tests in course
        tests_stmt = (
            select(ChapterTest)
            .join(Chapter, ChapterTest.chapter_id == Chapter.id)
            .where(Chapter.course_id == course_id)
        )
        tests_res = await session.execute(tests_stmt)
        chapter_tests = tests_res.scalars().all()
        test_ids = [t.id for t in chapter_tests]

        # 4. First-attempts and Re-attempts
        attempts = []
        if test_ids:
            att_stmt = (
                select(TestAttempt)
                .where(
                    and_(
                        TestAttempt.chapter_test_id.in_(test_ids),
                        TestAttempt.submitted_at.isnot(None),
                    )
                )
            )
            att_res = await session.execute(att_stmt)
            attempts = att_res.scalars().all()

        first_attempts = [a for a in attempts if a.is_first_attempt]
        reattempts = [a for a in attempts if not a.is_first_attempt]

        avg_score = (
            sum((a.score / a.max_score * 100) for a in first_attempts if a.max_score > 0) / len(first_attempts)
            if first_attempts
            else 0.0
        )

        # 5. Rating info
        rating_resp = await TeacherAnalyticsService.get_course_rating(session, course_id)

        # 6. Student progress items & struggle counts
        students_summary = []
        struggling_count = 0

        for e in enrolments:
            s = e.student
            s_name = s.display_name if s else "Student"

            # Student attempts on course tests
            s_attempts = [a for a in attempts if a.student_id == s.id]
            s_first = next((a for a in s_attempts if a.is_first_attempt), None)
            s_latest = s_attempts[-1] if s_attempts else None

            first_score = (
                round(s_first.score / s_first.max_score * 100, 1)
                if s_first and s_first.max_score > 0
                else None
            )
            latest_score = (
                round(s_latest.score / s_latest.max_score * 100, 1)
                if s_latest and s_latest.max_score > 0
                else None
            )

            # Check recent struggle assessment
            sa_stmt = (
                select(StruggleAssessment)
                .where(StruggleAssessment.student_id == s.id)
                .order_by(desc(StruggleAssessment.created_at))
                .limit(1)
            )
            sa_res = await session.execute(sa_stmt)
            latest_sa = sa_res.scalar_one_or_none()

            risk_level = latest_sa.risk_level if latest_sa else "low"
            if risk_level in ("medium", "high"):
                struggling_count += 1

            students_summary.append(
                StudentProgressItem(
                    student_id=s.id,
                    student_name=s_name,
                    first_attempt_score=first_score,
                    latest_attempt_score=latest_score,
                    attempts_count=len(s_attempts),
                    struggle_risk_level=risk_level,
                )
            )

        # 7. AI Co-Pilot Narrative Summary
        metrics = {
            "enrolled_students": enrolled_count,
            "completed_first_attempts": len(first_attempts),
            "avg_first_attempt_score": round(avg_score, 1),
            "total_reattempts": len(reattempts),
            "struggling_students_count": struggling_count,
        }
        copilot_summary = TeacherCopilotAgent.generate_narrative_summary(metrics)

        return CourseAnalyticsResponse(
            course_id=course_id,
            course_title=course.title,
            enrolled_students=enrolled_count,
            completed_first_attempts=len(first_attempts),
            avg_first_attempt_score=round(avg_score, 1),
            total_reattempts=len(reattempts),
            struggling_students_count=struggling_count,
            rating=rating_resp,
            copilot_summary=copilot_summary,
            students_summary=students_summary,
        )
