from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models.identity import User, Student, DisabilityProfile
from app.db.models.content import Course
from app.db.models.reference import AgeBand, DisabilityType
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
                selectinload(Student.disabilities).selectinload(DisabilityProfile.disability_type),
            )
        )
        res = await session.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

        # Guard: Current user must be the student or their parent
        if current_user.role == "student" and (not current_user.student_profile or current_user.student_profile.id != student.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other student diagnostic.")
        if current_user.role == "parent" and student.parent_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other student diagnostic.")

        disability_codes = [d.disability_type.code for d in student.disabilities if d.disability_type]
        age_band_code = student.age_band.code if student.age_band else "11-15"

        # Create Diagnostic row
        first_disability_id = student.disabilities[0].disability_type_id if student.disabilities else None
        if not first_disability_id:
            dt_res = await session.execute(select(DisabilityType).limit(1))
            first_disability_id = dt_res.scalar_one().id

        diagnostic = Diagnostic(
            student_id=student.id,
            age_at_test=student.age,
            disability_type_id=first_disability_id,
            score=0.0,
            max_score=0.0,
        )
        session.add(diagnostic)
        await session.flush()

        # Invoke DiagnosticPlacementAgent via MCP router
        ctx = RequestContext(
            user_id=current_user.id,
            role=current_user.role,
            student_id=student.id,
            disability_types=disability_codes,
            age_band=age_band_code,
        )
        decision = Decision(intent="placement_diagnostic")

        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "sub_action": "generate_questions",
                "age": student.age,
                "min_age": student.age_band.min_age if student.age_band else 11,
                "max_age": student.age_band.max_age if student.age_band else 15,
                "num_questions": 4,
            },
        )

        questions_data = []
        for r in agent_responses:
            if r.agent_name == "diagnostic_placement" and r.status == "success":
                questions_data = r.data.get("questions", [])
                break

        if not questions_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Diagnostic agent failed to generate questions.",
            )

        created_questions: List[QuestionSchema] = []
        for q_data in questions_data:
            q_row = Question(
                parent_type="diagnostic",
                parent_id=diagnostic.id,
                prompt=q_data["prompt"],
                question_type="mcq",
                options=q_data["options"],
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", "easy"),
            )
            session.add(q_row)
            await session.flush()

            created_questions.append(
                QuestionSchema(
                    id=q_row.id,
                    prompt=q_row.prompt,
                    question_type=q_row.question_type,
                    options=[QuestionOption(**opt) for opt in q_row.options],
                    correct_answer=CorrectAnswer(**q_row.correct_answer),
                    explanation=q_row.explanation,
                    difficulty=q_row.difficulty,
                )
            )

        diagnostic.max_score = float(len(created_questions))
        await session.commit()

        return DiagnosticStartResponse(
            diagnostic_id=diagnostic.id,
            student_id=student.id,
            age=student.age,
            age_band_label=student.age_band.label if student.age_band else age_band_code,
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
                selectinload(Diagnostic.student)
                .selectinload(Student.disabilities)
                .selectinload(DisabilityProfile.disability_type),
                selectinload(Diagnostic.answers),
            )
        )
        res = await session.execute(stmt)
        diagnostic = res.scalar_one_or_none()
        if not diagnostic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic test not found.")

        student = diagnostic.student
        if current_user.role == "student" and (not current_user.student_profile or current_user.student_profile.id != student.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized.")

        # Fetch questions for this diagnostic
        q_res = await session.execute(
            select(Question).where(
                and_(Question.parent_id == diagnostic.id, Question.parent_type == "diagnostic")
            )
        )
        questions_by_id = {q.id: q for q in q_res.scalars().all()}

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
            disability_types=[d.disability_type.code for d in student.disabilities if d.disability_type],
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

        await session.commit()
        await session.refresh(diagnostic)

        percentage = (score / max_score * 100) if max_score > 0 else 0.0

        return DiagnosticResultResponse(
            diagnostic_id=diagnostic.id,
            student_id=student.id,
            score=score,
            max_score=max_score,
            percentage=percentage,
            recommended_course_id=rec_course_id,
            recommended_course_title=rec_course_title,
            explanation=placement_data.get("explanation", "Recommended course based on diagnostic score and age band."),
            strengths=placement_data.get("strengths", []),
            focus_areas=placement_data.get("focus_areas", []),
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

        rec_title = diagnostic.recommended_course.title if diagnostic.recommended_course else None
        percentage = (diagnostic.score / diagnostic.max_score * 100) if diagnostic.max_score > 0 else 0.0

        return DiagnosticResultResponse(
            diagnostic_id=diagnostic.id,
            student_id=diagnostic.student_id,
            score=diagnostic.score,
            max_score=diagnostic.max_score,
            percentage=percentage,
            recommended_course_id=diagnostic.recommended_course_id,
            recommended_course_title=rec_title,
            explanation=f"Diagnostic score: {diagnostic.score}/{diagnostic.max_score}. Recommended placement for age band.",
            strengths=["Completed initial placement evaluation"],
            focus_areas=["Ready to begin guided lessons and practice"],
        )

    @staticmethod
    async def enrol_in_course(
        session: AsyncSession,
        course_id: str,
        current_user: User,
    ) -> EnrolmentResponse:
        if not current_user.student_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only students can enrol in courses.",
            )

        student_id = current_user.student_profile.id

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
