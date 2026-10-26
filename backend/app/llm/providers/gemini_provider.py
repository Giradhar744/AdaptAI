from typing import Optional, Dict, Any, List
from app.core.config import settings
from app.llm.providers.openai_provider import OpenAILLMProvider


class GeminiLLMProvider(OpenAILLMProvider):
    """Google Gemini Provider using Gemini's official OpenAI-compatible endpoint:
    https://generativelanguage.googleapis.com/v1beta/openai/
    Supports models like gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        gemini_api_key = api_key or settings.LLM_API_KEY
        gemini_model = model or (settings.LLM_MODEL if settings.LLM_MODEL != "fake-default" else "gemini-1.5-flash")
        gemini_base_url = base_url or settings.LLM_BASE_URL or "https://generativelanguage.googleapis.com/v1beta/openai/"

        super().__init__(
            api_key=gemini_api_key,
            model=gemini_model,
            base_url=gemini_base_url,
        )
