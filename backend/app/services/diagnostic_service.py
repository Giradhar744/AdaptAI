from typing import List, Optional
from sqlalchemy import select, and_, desc, delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models.identity import User, Student
from app.db.models.content import Course
from app.db.models.reference import DisabilityType, AgeBand
from app.db.models.diagnostic import Diagnostic, DiagnosticAnswer
from app.db.models.practice import Question
from app.db.models.progress import Enrolment
from app.llm.decision_layer import RequestContext, Decision
from app.mcp.router import MCPRouter
from app.schemas.diagnostic import (
    DiagnosticStartResponse,
    DiagnosticSubmitRequest,
    DiagnosticResultResponse,
    EnrolmentResponse,
)
from app.schemas.content_gen import QuestionSchema, QuestionOption, CorrectAnswer


class DiagnosticService:

    @staticmethod
    async def start_diagnostic(
        session: AsyncSession,
        student_id: str,
        current_user: User,
    ) -> DiagnosticStartResponse:
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(
                selectinload(Student.age_band),
            )
        )
        res = await session.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

        # Guard: Current user must be the student or their parent
        if current_user.role == "student" and student.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other student diagnostic.")
        if current_user.role == "parent" and student.parent_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other student diagnostic.")

        # Guard: Enrollment test can only be taken once upon registration/onboarding; retest is strictly disabled
        completed_check = await session.execute(
            select(Diagnostic)
            .where(
                and_(
                    Diagnostic.student_id == student.id,
                    (Diagnostic.recommended_course_id.is_not(None)) | (Diagnostic.score > 0.0),
                )
            )
            .limit(1)
        )
        has_completed = completed_check.scalar_one_or_none() is not None
        if not has_completed:
            answers_check = await session.execute(
                select(DiagnosticAnswer)
                .join(Diagnostic, Diagnostic.id == DiagnosticAnswer.diagnostic_id)
                .where(Diagnostic.student_id == student.id)
                .limit(1)
            )
            if answers_check.scalar_one_or_none() is not None:
                has_completed = True

        if has_completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enrollment test has already been completed. Retests are disabled.",
            )

        # Clean up any abandoned unsubmitted diagnostic with 0 answers from previous interrupted attempt
        res_empty = await session.execute(
            select(Diagnostic).where(
                and_(
                    Diagnostic.student_id == student.id,
                    Diagnostic.recommended_course_id.is_(None),
                )
            )
        )
        for d_empty in res_empty.scalars().all():
            ans_count = await session.execute(
                select(func.count(DiagnosticAnswer.id)).where(DiagnosticAnswer.diagnostic_id == d_empty.id)
            )
            if (ans_count.scalar() or 0) == 0:
                await session.execute(delete(Question).where(Question.parent_id == d_empty.id))
                await session.delete(d_empty)
        await session.flush()

        import uuid
        diag_id = str(uuid.uuid4())
        diagnostic = Diagnostic(
            id=diag_id,
            student_id=student.id,
            age_at_test=student.age,
            disability_type_id=None,
            score=0.0,
            max_score=10.0,
        )
        session.add(diagnostic)

        # Load fixed 10 questions across English, Science, Basic Reasoning, Maths, and Hindi
        from app.db.diagnostic_questions import FIXED_DIAGNOSTIC_QUESTIONS

        created_questions: List[QuestionSchema] = []
        for q_data in FIXED_DIAGNOSTIC_QUESTIONS:
            q_id = str(uuid.uuid4())
            q_row = Question(
                id=q_id,
                parent_type="diagnostic",
                parent_id=diag_id,
                prompt=q_data["prompt"],
                question_type="mcq",
                options=q_data["options"],
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", "medium"),
            )
            session.add(q_row)

            created_questions.append(
                QuestionSchema(
                    id=q_id,
                    prompt=q_data["prompt"],
                    question_type="mcq",
                    options=[QuestionOption(**opt) for opt in q_data["options"]],
                    correct_answer=CorrectAnswer(**q_data["correct_answer"]),
                    explanation=q_data.get("explanation"),
                    difficulty=q_data.get("difficulty", "medium"),
                )
            )

        await session.commit()

        age_label = student.age_band.label if student.age_band else "Pending Enrollment Test"
        return DiagnosticStartResponse(
            diagnostic_id=diag_id,
            student_id=student.id,
            age=student.age,
            age_band_label=age_label,
            questions=created_questions,
        )

    @staticmethod
    async def submit_diagnostic(
        session: AsyncSession,
        diagnostic_id: str,
        current_user: User,
        req: DiagnosticSubmitRequest,
    ) -> DiagnosticResultResponse:
        stmt = (
            select(Diagnostic)
            .where(Diagnostic.id == diagnostic_id)
            .options(
                selectinload(Diagnostic.student)
                .selectinload(Student.age_band),
                selectinload(Diagnostic.answers),
            )
        )
        res = await session.execute(stmt)
        diagnostic = res.scalar_one_or_none()
        if not diagnostic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic test not found.")

        student = diagnostic.student
        if current_user.role == "student" and student.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized.")
        if current_user.role == "parent" and student.parent_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized.")

        # Fetch questions for this diagnostic
        q_res = await session.execute(
            select(Question).where(
                and_(Question.parent_id == diagnostic.id, Question.parent_type == "diagnostic")
            )
        )
        questions_by_id = {q.id: q for q in q_res.scalars().all()}

        # Clear any prior answers if re-submitting to ensure idempotent submission
        await session.execute(
            delete(DiagnosticAnswer).where(DiagnosticAnswer.diagnostic_id == diagnostic.id)
        )

        # Score submitted answers
        score = 0.0
        for ans in req.answers:
            q = questions_by_id.get(ans.question_id)
            if not q:
                continue

            correct_key = q.correct_answer.get("key")
            is_correct = (ans.selected_key == correct_key)
            if is_correct:
                score += 1.0

            ans_row = DiagnosticAnswer(
                diagnostic_id=diagnostic.id,
                question_id=q.id,
                answer={"selected_key": ans.selected_key},
                is_correct=is_correct,
                time_taken_ms=ans.time_taken_ms,
            )
            session.add(ans_row)

        diagnostic.score = score
        max_score = float(len(questions_by_id)) if questions_by_id else 1.0
        diagnostic.max_score = max_score

        # Query candidate published courses
        courses_res = await session.execute(
            select(Course)
            .where(Course.is_published.is_(True))
            .options(selectinload(Course.age_band))
        )
        candidate_courses = [
            {
                "id": c.id,
                "title": c.title,
                "subject": c.subject,
                "age_band_code": c.age_band.code if c.age_band else "",
            }
            for c in courses_res.scalars().all()
        ]

        # Invoke DiagnosticPlacementAgent for placement recommendation (PROJECT.md §10.2)
        ctx = RequestContext(
            user_id=current_user.id,
            role=current_user.role,
            student_id=student.id,
            age_band=student.age_band.code if student.age_band else "11-15",
            disability_types=[],
        )
        decision = Decision(intent="placement_diagnostic")

        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "sub_action": "compute_placement",
                "score": score,
                "max_score": max_score,
                "candidate_courses": candidate_courses,
            },
        )

        placement_data = {}
        for r in agent_responses:
            if r.agent_name == "diagnostic_placement" and r.status == "success":
                placement_data = r.data
                break

        rec_course_id = placement_data.get("recommended_course_id")
        rec_course_title = placement_data.get("recommended_course_title")
        diagnostic.recommended_course_id = rec_course_id
        rec_age_band = placement_data.get("recommended_age_band", "11-15")

        # Update student's profile age band to match placement batch
        band_res = await session.execute(
            select(AgeBand).where(AgeBand.code == rec_age_band)
        )
        placed_band = band_res.scalar_one_or_none()
        if placed_band:
            student.age_band_id = placed_band.id
            student.age_band = placed_band

        # Note: Student is NOT automatically enrolled into the recommended course.
        # The student can accept or decline on the recommendation screen, or enrol later from Explore Courses.

        diag_id = diagnostic.id
        student_id = student.id

        await session.commit()

        percentage = (score / max_score * 100) if max_score > 0 else 0.0

        return DiagnosticResultResponse(
            diagnostic_id=diag_id,
            student_id=student_id,
            score=score,
            max_score=max_score,
            percentage=round(percentage, 1),
            score_percentage=round(percentage, 1),
            assigned_age_band=rec_age_band,
            total_questions=int(max_score),
            correct_count=int(score),
            recommended_age_band=rec_age_band,
            progression_age_band=placement_data.get("progression_age_band"),
            recommended_course_id=rec_course_id,
            recommended_course_title=rec_course_title,
            recommended_courses=placement_data.get("recommended_courses", []),
            progression_courses=placement_data.get("progression_courses", []),
            explanation=placement_data.get("explanation", "Recommended course based on enrollment test score."),
            strengths=placement_data.get("strengths", []),
            focus_areas=placement_data.get("focus_areas", []),
        )

    @staticmethod
    async def get_latest_student_diagnostic(
        session: AsyncSession,
        student_id: str,
        current_user: User,
    ) -> Optional[DiagnosticResultResponse]:
        # Query most recent submitted diagnostic for this student
        stmt = (
            select(Diagnostic)
            .where(
                and_(
                    Diagnostic.student_id == student_id,
                    Diagnostic.recommended_course_id.is_not(None),
                )
            )
            .order_by(desc(Diagnostic.created_at))
            .options(
                selectinload(Diagnostic.student).selectinload(Student.age_band),
                selectinload(Diagnostic.recommended_course),
            )
            .limit(1)
        )
        res = await session.execute(stmt)
        diagnostic = res.scalar_one_or_none()
        if not diagnostic:
            # Fallback only to a diagnostic with score or recommendation
            stmt_fallback = (
                select(Diagnostic)
                .where(
                    and_(
                        Diagnostic.student_id == student_id,
                        (Diagnostic.recommended_course_id.is_not(None)) | (Diagnostic.score > 0.0),
                    )
                )
                .order_by(desc(Diagnostic.created_at))
                .options(
                    selectinload(Diagnostic.student).selectinload(Student.age_band),
                    selectinload(Diagnostic.recommended_course),
                )
                .limit(1)
            )
            res_fallback = await session.execute(stmt_fallback)
            diagnostic = res_fallback.scalar_one_or_none()

        if not diagnostic:
            return None

        percentage = (diagnostic.score / diagnostic.max_score * 100) if diagnostic.max_score > 0 else 0.0
        diag_id = diagnostic.id
        student_id = diagnostic.student_id
        diag_score = diagnostic.score
        diag_max = diagnostic.max_score
        rec_title = diagnostic.recommended_course.title if diagnostic.recommended_course else None
        rec_id = diagnostic.recommended_course_id

        if percentage < 50.0:
            target_band = "7-10"
        elif percentage <= 75.0:
            target_band = "11-15"
        else:
            target_band = "15-20"

        # Auto-heal / sync student.age_band_id in DB if it was out of sync with test placement
        band_stmt = select(AgeBand).where(AgeBand.code == target_band)
        band_res = await session.execute(band_stmt)
        placed_band = band_res.scalar_one_or_none()
        if placed_band and diagnostic.student and diagnostic.student.age_band_id != placed_band.id:
            diagnostic.student.age_band_id = placed_band.id
            diagnostic.student.age_band = placed_band
            await session.commit()

        BATCH_RANKS = {
            "7-10": 1,
            "11-15": 2,
            "15-20": 3,
            "16-20": 3,
        }
        target_rank = BATCH_RANKS.get(target_band, 2)
        progression_band = None

        # Query candidate published courses
        courses_res = await session.execute(
            select(Course)
            .where(Course.is_published.is_(True))
            .options(selectinload(Course.age_band))
        )
        all_courses = [
            {
                "id": c.id,
                "title": c.title,
                "subject": c.subject,
                "fee": getattr(c, "fee", 0.0),
                "age_band_code": c.age_band.code if c.age_band else "",
                "description": c.description,
            }
            for c in courses_res.scalars().all()
        ]

        # Courses of student's batch and all higher batches
        rec_courses = [
            c for c in all_courses
            if BATCH_RANKS.get(c.get("age_band_code"), 1) >= target_rank
        ]
        exact_courses = [c for c in all_courses if c.get("age_band_code") == target_band]
        if not rec_title:
            rec_title = exact_courses[0]["title"] if exact_courses else (rec_courses[0]["title"] if rec_courses else None)
        if not rec_id:
            rec_id = exact_courses[0]["id"] if exact_courses else (rec_courses[0]["id"] if rec_courses else None)

        return DiagnosticResultResponse(
            diagnostic_id=diag_id,
            student_id=student_id,
            score=diag_score,
            max_score=diag_max,
            percentage=round(percentage, 1),
            score_percentage=round(percentage, 1),
            assigned_age_band=target_band,
            total_questions=int(diagnostic.max_score),
            correct_count=int(diagnostic.score),
            recommended_age_band=target_band,
            progression_age_band=progression_band,
            recommended_course_id=rec_id,
            recommended_course_title=rec_title,
            recommended_courses=rec_courses,
            progression_courses=[],
            explanation=(
                f"Based on your enrollment test score of {diagnostic.score:.0f}/{diagnostic.max_score:.0f} ({percentage:.0f}%), "
                f"your recommended learning batch is {'Batch Alpha' if target_band == '7-10' else ('Batch Gamma' if target_band in ['15-20', '16-20'] else 'Batch Beta')}."
            ),
            strengths=["Completed initial enrollment evaluation"],
            focus_areas=["Ready for self-paced practice with accessible hints"],
        )

    @staticmethod
    async def get_recommendation(
        session: AsyncSession,
        diagnostic_id: str,
        current_user: User,
    ) -> DiagnosticResultResponse:
        stmt = (
            select(Diagnostic)
            .where(Diagnostic.id == diagnostic_id)
            .options(
                selectinload(Diagnostic.student).selectinload(Student.age_band),
                selectinload(Diagnostic.recommended_course),
            )
        )
        res = await session.execute(stmt)
        diagnostic = res.scalar_one_or_none()
        if not diagnostic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found.")

        percentage = (diagnostic.score / diagnostic.max_score * 100) if diagnostic.max_score > 0 else 0.0

        if percentage < 50.0:
            target_band = "7-10"
        elif percentage <= 75.0:
            target_band = "11-15"
        else:
            target_band = "15-20"

        if not diagnostic.recommended_course_id:
            courses_res = await session.execute(
                select(Course)
                .where(Course.is_published.is_(True))
                .options(selectinload(Course.age_band))
            )
            candidate_courses = courses_res.scalars().all()
            matched = [c for c in candidate_courses if c.age_band and c.age_band.code == target_band]
            selected = matched[0] if matched else (candidate_courses[0] if candidate_courses else None)
            if selected:
                diagnostic.recommended_course_id = selected.id
                await session.commit()
                # Reload diagnostic with recommended_course loaded
                stmt_reload = (
                    select(Diagnostic)
                    .where(Diagnostic.id == diagnostic_id)
                    .options(
                        selectinload(Diagnostic.student).selectinload(Student.age_band),
                        selectinload(Diagnostic.recommended_course),
                    )
                )
                diagnostic = (await session.execute(stmt_reload)).scalar_one()

        rec_title = diagnostic.recommended_course.title if diagnostic.recommended_course else None

        return DiagnosticResultResponse(
            diagnostic_id=diagnostic.id,
            student_id=diagnostic.student_id,
            score=diagnostic.score,
            max_score=diagnostic.max_score,
            percentage=round(percentage, 1),
            score_percentage=round(percentage, 1),
            assigned_age_band=target_band,
            total_questions=int(diagnostic.max_score),
            correct_count=int(diagnostic.score),
            recommended_age_band=target_band,
            progression_age_band=None,
            recommended_course_id=diagnostic.recommended_course_id,
            recommended_course_title=rec_title,
            explanation=f"Diagnostic score: {diagnostic.score:.0f}/{diagnostic.max_score:.0f} ({percentage:.0f}%). Recommended learning batch: {'Batch Alpha' if target_band == '7-10' else ('Batch Gamma' if target_band in ['15-20', '16-20'] else 'Batch Beta')}.",
            strengths=["Completed initial enrollment evaluation"],
            focus_areas=["Ready to begin guided lessons and practice"],
        )

    @staticmethod
    async def enrol_in_course(
        session: AsyncSession,
        course_id: str,
        current_user: User,
    ) -> EnrolmentResponse:
        s_res = await session.execute(select(Student).where(Student.user_id == current_user.id))
        student = s_res.scalar_one_or_none()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only students can enrol in courses.",
            )

        student_id = student.id

        course_res = await session.execute(select(Course).where(Course.id == course_id))
        course = course_res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

        # Check existing enrolment
        enrol_stmt = select(Enrolment).where(
            and_(Enrolment.student_id == student_id, Enrolment.course_id == course_id)
        )
        existing = (await session.execute(enrol_stmt)).scalar_one_or_none()
        if existing:
            return EnrolmentResponse(
                enrolment_id=existing.id,
                student_id=existing.student_id,
                course_id=existing.course_id,
                course_title=course.title,
                status=existing.status,
                enrolled_at=existing.enrolled_at.isoformat(),
            )

        enrolment = Enrolment(
            student_id=student_id,
            course_id=course_id,
            status="active",
        )
        session.add(enrolment)
        await session.commit()
        await session.refresh(enrolment)

        return EnrolmentResponse(
            enrolment_id=enrolment.id,
            student_id=enrolment.student_id,
            course_id=enrolment.course_id,
            course_title=course.title,
            status=enrolment.status,
            enrolled_at=enrolment.enrolled_at.isoformat(),
        )

    @staticmethod
    async def get_student_enrolments(
        session: AsyncSession,
        student_id: str,
        current_user: User,
    ) -> List[EnrolmentResponse]:
        stmt = (
            select(Enrolment)
            .where(Enrolment.student_id == student_id)
            .options(selectinload(Enrolment.course))
        )
        res = await session.execute(stmt)
        enrolments = res.scalars().all()

        return [
            EnrolmentResponse(
                enrolment_id=e.id,
                student_id=e.student_id,
                course_id=e.course_id,
                course_title=e.course.title if e.course else "Unknown Course",
                status=e.status,
                enrolled_at=e.enrolled_at.isoformat(),
            )
            for e in enrolments
        ]
