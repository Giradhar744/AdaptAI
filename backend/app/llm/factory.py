import asyncio
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.core.logging import logger
from app.llm.base import LLMProvider, Message, LLMResult, LLMProviderError
from app.llm.providers.fake import FakeLLMProvider


class ResilientLLMClient:
    """Wrapper that manages timeouts and automatic retries up to LLM_MAX_RETRIES (PROJECT.md §7)."""

    def __init__(self, provider: LLMProvider, max_retries: int = 2, timeout: float = 30.0):
        self.provider = provider
        self.max_retries = max_retries
        self.timeout = timeout

    async def complete(
        self,
        messages: List[Message],
        *,
        json_schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> LLMResult:
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                return await asyncio.wait_for(
                    self.provider.complete(
                        messages=messages,
                        json_schema=json_schema,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    ),
                    timeout=self.timeout,
                )
            except (asyncio.TimeoutError, LLMProviderError, Exception) as err:
                last_error = err
                logger.warning(
                    f"LLM attempt {attempt + 1}/{self.max_retries + 1} failed: {type(err).__name__}. Retrying..."
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(0.1 * (2 ** attempt))

        raise LLMProviderError(f"LLM call failed after {self.max_retries + 1} attempts: {last_error}") from last_error


def get_llm_provider(provider_name: Optional[str] = None) -> ResilientLLMClient:
    """Factory creating an LLM client configured via environment settings."""
    name = (provider_name or settings.LLM_PROVIDER).lower()

    if name == "fake":
        raw_provider = FakeLLMProvider()
    else:
        # Fallback to Fake with a warning if an unconfigured external provider is named
        logger.warning(f"Unknown or unconfigured LLM provider '{name}', falling back to FakeLLMProvider.")
        raw_provider = FakeLLMProvider()

    return ResilientLLMClient(
        provider=raw_provider,
        max_retries=settings.LLM_MAX_RETRIES,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )
