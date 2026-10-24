from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.base import utc_now
from app.db.models.identity import User, Student
from app.db.models.content import Course, Chapter
from app.db.models.practice import ChapterTest, Question, TestAttempt, AttemptAnswer
from app.db.models.rating import CourseRating
from app.schemas.test_and_analytics import (
    SafeTestQuestion,
    TestQuestionOption,
    TestAttemptStartResponse,
    TestSubmitRequest,
    AnswerFeedback,
    TestAttemptResultResponse,
)
from app.agents.teacher_copilot import TeacherCopilotAgent


class ChapterTestService:

    @staticmethod
    async def start_test_attempt(
        session: AsyncSession,
        current_user: User,
        chapter_test_id: str,
    ) -> TestAttemptStartResponse:
        if not current_user.student_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only students can start chapter tests.",
            )

        student_id = current_user.student_profile.id

        # 1. Fetch ChapterTest with its questions
        stmt = (
            select(ChapterTest)
            .where(ChapterTest.id == chapter_test_id)
            .options(selectinload(ChapterTest.questions))
        )
        res = await session.execute(stmt)
        test = res.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter test not found.")

        # 2. Count existing attempts to strictly set attempt_number & is_first_attempt (PROJECT.md §11 rule 1)
        count_stmt = select(func.count(TestAttempt.id)).where(
            and_(
                TestAttempt.chapter_test_id == chapter_test_id,
                TestAttempt.student_id == student_id,
            )
        )
        count_res = await session.execute(count_stmt)
        existing_count = count_res.scalar_one()

        attempt_number = existing_count + 1
        is_first_attempt = (attempt_number == 1)

        # 3. Server-enforced start time & expiration
        started_at = utc_now()
        expires_at = started_at + timedelta(seconds=test.time_limit_seconds)

        attempt = TestAttempt(
            chapter_test_id=chapter_test_id,
            student_id=student_id,
            attempt_number=attempt_number,
            started_at=started_at,
            is_first_attempt=is_first_attempt,
            score=0.0,
            max_score=float(len(test.questions)),
        )
        session.add(attempt)
        await session.commit()
        await session.refresh(attempt)

        # 4. Return sanitized questions (without exposing correct answers)
        safe_questions = [
            SafeTestQuestion(
                id=q.id,
                prompt=q.prompt,
                question_type=q.question_type,
                options=[TestQuestionOption(key=opt["key"], text=opt["text"]) for opt in q.options],
                difficulty=q.difficulty,
            )
            for q in test.questions
        ]

        return TestAttemptStartResponse(
            attempt_id=attempt.id,
            chapter_test_id=test.id,
            student_id=student_id,
            attempt_number=attempt.attempt_number,
            is_first_attempt=attempt.is_first_attempt,
            time_limit_seconds=test.time_limit_seconds,
            started_at=attempt.started_at.isoformat(),
            expires_at=expires_at.isoformat(),
            questions=safe_questions,
        )

    @staticmethod
    async def submit_test_attempt(
        session: AsyncSession,
        current_user: User,
        attempt_id: str,
        req: TestSubmitRequest,
    ) -> TestAttemptResultResponse:
        if not current_user.student_profile:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students can submit tests.")

        student_id = current_user.student_profile.id

        # 1. Fetch attempt
        stmt = (
            select(TestAttempt)
            .where(TestAttempt.id == attempt_id, TestAttempt.student_id == student_id)
            .options(selectinload(TestAttempt.test).selectinload(ChapterTest.questions))
        )
        res = await session.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test attempt not found.")

        if attempt.submitted_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test attempt has already been submitted.")

        test = attempt.test
        now = utc_now()

        # 2. Server-enforced deadline validation (PROJECT.md §11 rule 3)
        started = attempt.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed_seconds = (now - started).total_seconds()
        grace_period_seconds = 60  # 60s transit grace
        is_late = elapsed_seconds > (test.time_limit_seconds + grace_period_seconds)

        # 3. Grade answers
        question_map = {q.id: q for q in test.questions}
        feedback_list = []
        earned_score = 0.0

        for user_ans in req.answers:
            q = question_map.get(user_ans.question_id)
            if not q:
                continue

            correct_key = q.correct_answer.get("key")
            is_correct = (user_ans.selected_key == correct_key)
            if is_correct:
                earned_score += 1.0

            ans_record = AttemptAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                answer={"selected_key": user_ans.selected_key},
                is_correct=is_correct,
                time_taken_ms=user_ans.time_taken_ms,
            )
            session.add(ans_record)

            feedback_list.append(
                AnswerFeedback(
                    question_id=q.id,
                    selected_key=user_ans.selected_key,
                    correct_key=correct_key or "",
                    is_correct=is_correct,
                    explanation=q.explanation,
                )
            )

        attempt.submitted_at = now
        attempt.score = earned_score
        attempt.max_score = float(len(test.questions))

        # 4. If this is a first attempt, recompute course rating immediately (PROJECT.md §6, §10.7)
        if attempt.is_first_attempt:
            await ChapterTestService.recompute_course_rating_for_test(session, test.id)

        await session.commit()
        await session.refresh(attempt)

        percentage = round((attempt.score / attempt.max_score * 100), 1) if attempt.max_score > 0 else 0.0

        return TestAttemptResultResponse(
            attempt_id=attempt.id,
            chapter_test_id=test.id,
            attempt_number=attempt.attempt_number,
            is_first_attempt=attempt.is_first_attempt,
            score=attempt.score,
            max_score=attempt.max_score,
            score_percentage=percentage,
            started_at=attempt.started_at.isoformat(),
            submitted_at=attempt.submitted_at.isoformat(),
            is_late=is_late,
            feedback=feedback_list,
        )

    @staticmethod
    async def get_attempt_result(
        session: AsyncSession,
        current_user: User,
        attempt_id: str,
    ) -> TestAttemptResultResponse:
        stmt = (
            select(TestAttempt)
            .where(TestAttempt.id == attempt_id)
            .options(
                selectinload(TestAttempt.test).selectinload(ChapterTest.questions),
                selectinload(TestAttempt.answers),
            )
        )
        res = await session.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")

        test = attempt.test
        question_map = {q.id: q for q in test.questions}

        feedback_list = []
        for a in attempt.answers:
            q = question_map.get(a.question_id)
            feedback_list.append(
                AnswerFeedback(
                    question_id=a.question_id,
                    selected_key=a.answer.get("selected_key", ""),
                    correct_key=q.correct_answer.get("key", "") if q else "",
                    is_correct=a.is_correct,
                    explanation=q.explanation if q else None,
                )
            )

        percentage = round((attempt.score / attempt.max_score * 100), 1) if attempt.max_score > 0 else 0.0
        started = attempt.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        sub_time = attempt.submitted_at or utc_now()
        if sub_time.tzinfo is None:
            sub_time = sub_time.replace(tzinfo=timezone.utc)
        elapsed = (sub_time - started).total_seconds()
        is_late = elapsed > (test.time_limit_seconds + 60)

        return TestAttemptResultResponse(
            attempt_id=attempt.id,
            chapter_test_id=test.id,
            attempt_number=attempt.attempt_number,
            is_first_attempt=attempt.is_first_attempt,
            score=attempt.score,
            max_score=attempt.max_score,
            score_percentage=percentage,
            started_at=attempt.started_at.isoformat(),
            submitted_at=attempt.submitted_at.isoformat() if attempt.submitted_at else "",
            is_late=is_late,
            feedback=feedback_list,
        )

    @staticmethod
    async def recompute_course_rating_for_test(session: AsyncSession, chapter_test_id: str) -> Optional[float]:
        """
        Recomputes course rating using strictly first attempts (is_first_attempt = true).
        """
        # Resolve course_id from chapter_test -> chapter -> course
        stmt = (
            select(Chapter.course_id)
            .join(ChapterTest, ChapterTest.chapter_id == Chapter.id)
            .where(ChapterTest.id == chapter_test_id)
        )
        res = await session.execute(stmt)
        course_id = res.scalar_one_or_none()
        if not course_id:
            return None

        # Fetch all submitted first attempts for any chapter test in this course
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

        rating_value = stars_data.get("rating_value") or 0.0
        count = len(ratios)

        # Update or insert CourseRating row
        cr_stmt = select(CourseRating).where(CourseRating.course_id == course_id)
        cr_res = await session.execute(cr_stmt)
        cr = cr_res.scalar_one_or_none()

        if not cr:
            cr = CourseRating(
                course_id=course_id,
                rating_value=rating_value,
                computed_from_attempt_count=count,
                computed_at=utc_now(),
            )
            session.add(cr)
        else:
            cr.rating_value = rating_value
            cr.computed_from_attempt_count = count
            cr.computed_at = utc_now()

        return rating_value
