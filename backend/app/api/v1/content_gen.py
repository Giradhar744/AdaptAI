from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_teacher
from app.schemas.content_gen import (
    DPPResponse,
    ChapterTestResponse,
    StatusUpdateRequest,
    QuestionSchema,
    QuestionUpdateRequest,
    QuestionCreateRequest,
)
from app.services.content_gen_service import ContentGenService

router = APIRouter(tags=["Content Generation"])


# 1. Topic DPP Endpoints
@router.post("/topics/{id}/dpp/generate", response_model=DPPResponse, status_code=status.HTTP_201_CREATED)
async def generate_topic_dpp(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Triggers one-click topic DPP generation using the Content Generation Agent."""
    return await ContentGenService.generate_topic_dpp(session, id, current_teacher)


@router.get("/topics/{id}/dpp", response_model=DPPResponse)
async def get_topic_dpp(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves the generated DPP questions for a topic."""
    return await ContentGenService.get_topic_dpp(session, id)


@router.get("/dpps/{id}", response_model=DPPResponse)
async def get_dpp_by_id(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves a Daily Practice (DPP) by its DPP ID."""
    return await ContentGenService.get_dpp_by_id(session, id)


@router.patch("/dpps/{id}", response_model=DPPResponse)
async def update_dpp_status(
    id: str,
    req: StatusUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates the status (draft | published) of a DPP (Teacher owner only)."""
    return await ContentGenService.update_dpp_status(session, id, current_teacher, req.status)


@router.delete("/dpps/{id}")
async def delete_dpp(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Deletes a DPP and its associated questions (Teacher owner only)."""
    return await ContentGenService.delete_dpp(session, id, current_teacher)


@router.post("/dpps/{id}/questions", response_model=QuestionSchema, status_code=status.HTTP_201_CREATED)
async def add_dpp_question(
    id: str,
    req: QuestionCreateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Adds a custom pedagogical question to a DPP (Teacher owner only)."""
    return await ContentGenService.add_dpp_question(
        session,
        id,
        current_teacher,
        req.model_dump(),
    )


@router.patch("/questions/{id}", response_model=QuestionSchema)
async def update_question(
    id: str,
    req: QuestionUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Edits question text, options, correct answer key, or explanation (Teacher owner only)."""
    options_list = [opt.model_dump() for opt in req.options] if req.options is not None else None
    correct_ans = req.correct_answer.model_dump() if req.correct_answer is not None else None
    return await ContentGenService.update_question(
        session,
        id,
        current_teacher,
        prompt=req.prompt,
        options=options_list,
        correct_answer=correct_ans,
        explanation=req.explanation,
        difficulty=req.difficulty,
    )


@router.delete("/questions/{id}")
async def delete_question(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Deletes an unsuitable question from a DPP or test (Teacher owner only)."""
    return await ContentGenService.delete_question(session, id, current_teacher)


# 2. Chapter Test Endpoints
@router.post("/chapters/{id}/test/generate", response_model=ChapterTestResponse, status_code=status.HTTP_201_CREATED)
async def generate_chapter_test(
    id: str,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Generates a timed chapter test across all topics in the chapter using the Content Generation Agent."""
    return await ContentGenService.generate_chapter_test(session, id, current_teacher)


@router.get("/chapters/{id}/test", response_model=ChapterTestResponse)
async def get_chapter_test(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves the chapter test questions and time limit."""
    return await ContentGenService.get_chapter_test(session, id)


@router.patch("/chapter-tests/{id}", response_model=ChapterTestResponse)
async def update_chapter_test_status(
    id: str,
    req: StatusUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates the status (draft | published) of a chapter test (Teacher owner only)."""
    return await ContentGenService.update_test_status(session, id, current_teacher, req.status)


from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.db.models.content import Chapter, Topic, Lecture
from app.db.models.practice import DPP


class LectureDPPGenerateRequest(BaseModel):
    description: Optional[str] = None
    topic_prompt: Optional[str] = None
    num_questions: Optional[int] = None
    difficulty: Optional[str] = "medium"


@router.post("/lectures/{id}/dpp/generate", response_model=DPPResponse, status_code=status.HTTP_201_CREATED)
async def generate_lecture_dpp(
    id: str,
    req: Optional[LectureDPPGenerateRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Triggers one-click lecture DPP generation using the Content Generation Agent."""
    desc = (req.description or req.topic_prompt) if req else None
    num_q = req.num_questions if req else None
    diff = (req.difficulty or "medium") if req else "medium"
    return await ContentGenService.generate_lecture_dpp(
        session, id, current_user, num_questions=num_q, difficulty=diff, lecture_description=desc
    )


@router.get("/lectures/{id}/dpp", response_model=DPPResponse)
async def get_lecture_dpp(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieves the generated DPP questions for a lecture."""
    stmt = (
        select(DPP)
        .where(DPP.lecture_id == id)
        .options(selectinload(DPP.questions))
    )
    res = await session.execute(stmt)
    dpp = res.scalar_one_or_none()
    if not dpp:
        # Fallback to chapter's topic DPP if available
        lec_res = await session.execute(
            select(Lecture).where(Lecture.id == id).options(
                selectinload(Lecture.chapter).selectinload(Chapter.topics)
            )
        )
        lec = lec_res.scalar_one_or_none()
        if lec and lec.chapter and lec.chapter.topics:
            return await ContentGenService.get_topic_dpp(session, lec.chapter.topics[0].id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No DPP found for this lecture.")

    return await ContentGenService.get_dpp_by_id(session, dpp.id)


class QuickDPPRequest(BaseModel):
    chapter_id: str
    topic_prompt: str
    num_questions: int = 5
    target_age_band: Optional[str] = None
    lecture_id: Optional[str] = None


class QuickTestRequest(BaseModel):
    chapter_id: str
    topic_prompt: Optional[str] = None
    num_questions: int = 5
    target_age_band: Optional[str] = None
    duration_minutes: int = 20


@router.post("/content/generate-dpp", response_model=DPPResponse, status_code=status.HTTP_201_CREATED)
async def generate_dpp_direct(
    req: QuickDPPRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Convenience studio endpoint: creates a topic under chapter and generates AI DPP."""
    if req.lecture_id:
        return await ContentGenService.generate_lecture_dpp(
            session,
            req.lecture_id,
            current_teacher,
            num_questions=req.num_questions,
            lecture_description=req.topic_prompt,
        )

    ch_res = await session.execute(select(Chapter).where(Chapter.id == req.chapter_id))
    chapter = ch_res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

    topic = Topic(
        chapter_id=req.chapter_id,
        title=req.topic_prompt,
        content_text=req.topic_prompt,
        position=1,
    )
    session.add(topic)
    await session.commit()
    await session.refresh(topic)

    return await ContentGenService.generate_topic_dpp(session, topic.id, current_teacher)


@router.post("/content/generate-chapter-test", response_model=ChapterTestResponse, status_code=status.HTTP_201_CREATED)
async def generate_chapter_test_direct(
    req: QuickTestRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Convenience studio endpoint: ensures chapter has topic content, then generates timed chapter test."""
    ch_res = await session.execute(select(Chapter).where(Chapter.id == req.chapter_id))
    chapter = ch_res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found.")

    top_res = await session.execute(select(Topic).where(Topic.chapter_id == req.chapter_id))
    topics = top_res.scalars().all()
    if not topics and req.topic_prompt:
        topic = Topic(
            chapter_id=req.chapter_id,
            title=req.topic_prompt,
            content_text=req.topic_prompt,
            position=1,
        )
        session.add(topic)
        await session.commit()

    return await ContentGenService.generate_chapter_test(session, req.chapter_id, current_teacher)

