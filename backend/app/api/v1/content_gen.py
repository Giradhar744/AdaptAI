from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models.identity import User
from app.core.deps import get_current_user, require_teacher
from app.schemas.content_gen import (
    DPPResponse,
    ChapterTestResponse,
    StatusUpdateRequest,
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


@router.patch("/dpps/{id}", response_model=DPPResponse)
async def update_dpp_status(
    id: str,
    req: StatusUpdateRequest,
    current_teacher: User = Depends(require_teacher),
    session: AsyncSession = Depends(get_db),
):
    """Updates the status (draft | published) of a DPP (Teacher owner only)."""
    return await ContentGenService.update_dpp_status(session, id, current_teacher, req.status)


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
