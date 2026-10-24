from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.models.identity import User
from app.db.models.content import Course, Chapter, Topic
from app.db.models.practice import DPP, ChapterTest, Question
from app.llm.decision_layer import RequestContext, Decision
from app.mcp.router import MCPRouter
from app.schemas.content_gen import (
    DPPResponse,
    ChapterTestResponse,
    QuestionSchema,
    QuestionOption,
    CorrectAnswer,
)
from app.core.config import settings


class ContentGenService:

    @staticmethod
    async def generate_topic_dpp(
        session: AsyncSession,
        topic_id: str,
        teacher_user: User,
    ) -> DPPResponse:
        stmt = (
            select(Topic)
            .where(Topic.id == topic_id)
            .options(
                selectinload(Topic.chapter)
                .selectinload(Chapter.course)
                .selectinload(Course.age_band)
            )
        )
        res = await session.execute(stmt)
        topic = res.scalar_one_or_none()
        if not topic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found.")

        course = topic.chapter.course
        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        # Build context & decision for agent routing
        ctx = RequestContext(
            user_id=teacher_user.id,
            role="teacher",
            course_id=course.id,
            chapter_id=topic.chapter_id,
            topic_id=topic.id,
            age_band=course.age_band.code if course.age_band else "11-15",
        )
        decision = Decision(intent="generate_dpp")

        # Invoke Content Generation Agent through MCP router
        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "topic_title": topic.title,
                "content_text": topic.content_text,
                "subject": course.subject,
                "num_questions": settings.DPP_DEFAULT_QUESTIONS,
            },
        )

        questions_data: List[dict] = []
        for r in agent_responses:
            if r.agent_name == "content_generation" and r.status == "success":
                questions_data = r.data.get("questions", [])
                break

        if not questions_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Content Generation Agent failed to generate questions.",
            )

        # Check if DPP already exists for this topic; reuse or create new
        existing_res = await session.execute(select(DPP).where(DPP.topic_id == topic_id))
        dpp = existing_res.scalar_one_or_none()
        if not dpp:
            dpp = DPP(topic_id=topic_id, generated_by="llm", status="published")
            session.add(dpp)
            await session.flush()
        else:
            # Delete previous questions if regenerating
            del_stmt = select(Question).where(
                and_(Question.parent_id == dpp.id, Question.parent_type == "dpp")
            )
            old_qs = (await session.execute(del_stmt)).scalars().all()
            for oq in old_qs:
                await session.delete(oq)

        created_questions: List[QuestionSchema] = []
        for q_data in questions_data:
            q_row = Question(
                parent_type="dpp",
                parent_id=dpp.id,
                prompt=q_data["prompt"],
                question_type=q_data.get("question_type", "mcq"),
                options=q_data["options"],
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", "medium"),
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

        await session.commit()

        return DPPResponse(
            id=dpp.id,
            topic_id=dpp.topic_id,
            generated_by=dpp.generated_by,
            status=dpp.status,
            questions_count=len(created_questions),
            questions=created_questions,
        )

    @staticmethod
    async def get_topic_dpp(session: AsyncSession, topic_id: str) -> DPPResponse:
        res = await session.execute(
            select(DPP)
            .where(DPP.topic_id == topic_id)
            .options(selectinload(DPP.questions))
        )
        dpp = res.scalar_one_or_none()
        if not dpp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No DPP found for this topic.")

        return DPPResponse(
            id=dpp.id,
            topic_id=dpp.topic_id,
            generated_by=dpp.generated_by,
            status=dpp.status,
            questions_count=len(dpp.questions),
            questions=[
                QuestionSchema(
                    id=q.id,
                    prompt=q.prompt,
                    question_type=q.question_type,
                    options=[QuestionOption(**opt) for opt in q.options],
                    correct_answer=CorrectAnswer(**q.correct_answer),
                    explanation=q.explanation,
                    difficulty=q.difficulty,
                )
                for q in dpp.questions
            ],
        )

    @staticmethod
    async def update_dpp_status(
        session: AsyncSession,
        dpp_id: str,
        teacher_user: User,
        new_status: str,
    ) -> DPPResponse:
        stmt = (
            select(DPP)
            .where(DPP.id == dpp_id)
            .options(
                selectinload(DPP.topic)
                .selectinload(Topic.chapter)
                .selectinload(Chapter.course),
                selectinload(DPP.questions),
            )
        )
        res = await session.execute(stmt)
        dpp = res.scalar_one_or_none()
        if not dpp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPP not found.")

        course = dpp.topic.chapter.course
        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        dpp.status = new_status
        await session.commit()
        await session.refresh(dpp)

        return DPPResponse(
            id=dpp.id,
            topic_id=dpp.topic_id,
            generated_by=dpp.generated_by,
            status=dpp.status,
            questions_count=len(dpp.questions),
            questions=[
                QuestionSchema(
                    id=q.id,
                    prompt=q.prompt,
                    question_type=q.question_type,
                    options=[QuestionOption(**opt) for opt in q.options],
                    correct_answer=CorrectAnswer(**q.correct_answer),
                    explanation=q.explanation,
                    difficulty=q.difficulty,
                )
                for q in dpp.questions
            ],
        )

    @staticmethod
    async def generate_chapter_test(
        session: AsyncSession,
        chapter_id: str,
        teacher_user: User,
    ) -> ChapterTestResponse:
        stmt = (
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(
                selectinload(Chapter.course).selectinload(Course.age_band),
                selectinload(Chapter.topics),
            )
        )
        res = await session.execute(stmt)
        chapter = res.scalar_one_or_none()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

        course = chapter.course
        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        combined_topic_content = "\n\n".join(
            [f"Topic: {t.title}\n{t.content_text}" for t in chapter.topics]
        )
        if not combined_topic_content:
            combined_topic_content = f"Chapter overview: {chapter.title} in subject {course.subject}."

        ctx = RequestContext(
            user_id=teacher_user.id,
            role="teacher",
            course_id=course.id,
            chapter_id=chapter.id,
            age_band=course.age_band.code if course.age_band else "11-15",
        )
        decision = Decision(intent="generate_chapter_test")

        agent_responses = await MCPRouter.route(
            ctx,
            decision,
            payload={
                "chapter_title": chapter.title,
                "content_text": combined_topic_content,
                "subject": course.subject,
                "num_questions": settings.TEST_DEFAULT_QUESTIONS,
            },
        )

        questions_data: List[dict] = []
        for r in agent_responses:
            if r.agent_name == "content_generation" and r.status == "success":
                questions_data = r.data.get("questions", [])
                break

        if not questions_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Content Generation Agent failed to generate test questions.",
            )

        # Retrieve or create ChapterTest
        existing_res = await session.execute(select(ChapterTest).where(ChapterTest.chapter_id == chapter_id))
        test = existing_res.scalar_one_or_none()
        if not test:
            test = ChapterTest(
                chapter_id=chapter_id,
                time_limit_seconds=settings.TEST_DEFAULT_MINUTES * 60,
                status="published",
            )
            session.add(test)
            await session.flush()
        else:
            del_stmt = select(Question).where(
                and_(Question.parent_id == test.id, Question.parent_type == "chapter_test")
            )
            old_qs = (await session.execute(del_stmt)).scalars().all()
            for oq in old_qs:
                await session.delete(oq)

        created_questions: List[QuestionSchema] = []
        for q_data in questions_data:
            q_row = Question(
                parent_type="chapter_test",
                parent_id=test.id,
                prompt=q_data["prompt"],
                question_type=q_data.get("question_type", "mcq"),
                options=q_data["options"],
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation"),
                difficulty=q_data.get("difficulty", "medium"),
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

        await session.commit()

        return ChapterTestResponse(
            id=test.id,
            chapter_id=test.chapter_id,
            time_limit_seconds=test.time_limit_seconds,
            status=test.status,
            questions_count=len(created_questions),
            questions=created_questions,
        )

    @staticmethod
    async def get_chapter_test(session: AsyncSession, chapter_id: str) -> ChapterTestResponse:
        res = await session.execute(
            select(ChapterTest)
            .where(ChapterTest.chapter_id == chapter_id)
            .options(selectinload(ChapterTest.questions))
        )
        test = res.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No test found for this chapter.")

        return ChapterTestResponse(
            id=test.id,
            chapter_id=test.chapter_id,
            time_limit_seconds=test.time_limit_seconds,
            status=test.status,
            questions_count=len(test.questions),
            questions=[
                QuestionSchema(
                    id=q.id,
                    prompt=q.prompt,
                    question_type=q.question_type,
                    options=[QuestionOption(**opt) for opt in q.options],
                    correct_answer=CorrectAnswer(**q.correct_answer),
                    explanation=q.explanation,
                    difficulty=q.difficulty,
                )
                for q in test.questions
            ],
        )

    @staticmethod
    async def update_test_status(
        session: AsyncSession,
        test_id: str,
        teacher_user: User,
        new_status: str,
    ) -> ChapterTestResponse:
        stmt = (
            select(ChapterTest)
            .where(ChapterTest.id == test_id)
            .options(
                selectinload(ChapterTest.chapter).selectinload(Chapter.course),
                selectinload(ChapterTest.questions),
            )
        )
        res = await session.execute(stmt)
        test = res.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter test not found.")

        course = test.chapter.course
        if not teacher_user.teacher_profile or course.teacher_id != teacher_user.teacher_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this course.")

        test.status = new_status
        await session.commit()
        await session.refresh(test)

        return ChapterTestResponse(
            id=test.id,
            chapter_id=test.chapter_id,
            time_limit_seconds=test.time_limit_seconds,
            status=test.status,
            questions_count=len(test.questions),
            questions=[
                QuestionSchema(
                    id=q.id,
                    prompt=q.prompt,
                    question_type=q.question_type,
                    options=[QuestionOption(**opt) for opt in q.options],
                    correct_answer=CorrectAnswer(**q.correct_answer),
                    explanation=q.explanation,
                    difficulty=q.difficulty,
                )
                for q in test.questions
            ],
        )
