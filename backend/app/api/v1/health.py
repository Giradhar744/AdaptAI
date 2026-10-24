from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str
    providers: dict
    agents: dict


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Health check endpoint providing platform status and active provider configuration."""
    return HealthResponse(
        status="healthy",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        providers={
            "llm": settings.LLM_PROVIDER,
            "tts": settings.TTS_PROVIDER,
            "stt": settings.STT_PROVIDER,
            "video": settings.VIDEO_PROVIDER,
        },
        agents={
            "diagnostic": settings.AGENT_DIAGNOSTIC_ENABLED,
            "zpd_hint": settings.AGENT_ZPD_HINT_ENABLED,
            "content_gen": settings.AGENT_CONTENT_GEN_ENABLED,
            "struggle_detection": settings.AGENT_STRUGGLE_ENABLED,
            "consent_trust": settings.AGENT_CONSENT_ENABLED,
            "teacher_copilot": settings.AGENT_TEACHER_COPILOT_ENABLED,
        },
    )
