import json
import re
import time
from typing import List, Optional, Dict, Any
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.llm.base import LLMProvider, Message, LLMResult, LLMProviderError


class OpenAILLMProvider:
    """Production LLM Provider using direct asynchronous HTTP calls to any
    OpenAI-compatible chat completions API (e.g., NVIDIA NIM, OpenAI, OpenRouter,
    Groq, DeepSeek, Local Ollama, Gemini).
    Does not require third-party openai library.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key or settings.LLM_API_KEY
        default_model = "gpt-4o-mini"
        configured_model = settings.LLM_MODEL
        self.model = model or (configured_model if configured_model and configured_model != "fake-default" else default_model)

        raw_base = base_url or settings.LLM_BASE_URL or "https://api.openai.com/v1"
        self.base_url = raw_base.rstrip("/")
        if self.base_url.endswith("/chat/completions"):
            self.endpoint = self.base_url
        else:
            self.endpoint = f"{self.base_url}/chat/completions"

    async def complete(
        self,
        messages: List[Message],
        *,
        json_schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> LLMResult:
        start_time = time.perf_counter()
        openai_messages = [{"role": m.role, "content": m.content} for m in messages]

        # If schema is requested, ensure prompt explicitly demands strictly valid JSON
        if json_schema and not any("JSON" in m.content for m in messages):
            openai_messages.append({
                "role": "user",
                "content": f"Output your response strictly as valid JSON adhering to this schema:\n{json.dumps(json_schema)}",
            })

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        # Pass response_format for models that support it
        if json_schema:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        timeout_sec = float(getattr(settings, "LLM_TIMEOUT_SECONDS", 90))
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            try:
                resp = await client.post(self.endpoint, json=payload, headers=headers)
            except Exception as exc:
                raise LLMProviderError(f"Network error connecting to {self.endpoint}: {exc}") from exc

            # If response_format json_object caused 400 error (some models don't support response_format), retry once without it
            if resp.status_code == 400 and "response_format" in payload:
                payload.pop("response_format", None)
                try:
                    resp = await client.post(self.endpoint, json=payload, headers=headers)
                except Exception as exc:
                    raise LLMProviderError(f"Network error on retry to {self.endpoint}: {exc}") from exc

            if resp.status_code >= 400:
                raise LLMProviderError(f"LLM API ({self.model}) returned HTTP {resp.status_code}: {resp.text[:300]}")

            try:
                data = resp.json()
            except Exception as exc:
                raise LLMProviderError(f"LLM API response was not valid JSON: {resp.text[:300]}") from exc

        choices = data.get("choices")
        if not choices:
            raise LLMProviderError(f"LLM API returned no choices: {data}")

        text = choices[0].get("message", {}).get("content", "") or ""
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        parsed_data = None
        if json_schema:
            parsed_data = self._extract_json(text)
            if parsed_data is None:
                raise LLMProviderError(f"Failed to parse structured JSON from LLM response:\n{text[:300]}")

        usage = data.get("usage") or {}
        token_usage = {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        }

        logger.info(f"LLM call ({self.model}) completed in {elapsed_ms}ms ({token_usage.get('total_tokens', 0)} tokens)")
        return LLMResult(
            text=text,
            parsed=parsed_data,
            latency_ms=elapsed_ms,
            token_usage=token_usage,
        )

    def _extract_json(self, raw: str) -> Optional[Dict[str, Any]]:
        raw = raw.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        bracket_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", raw)
        if bracket_match:
            try:
                return json.loads(bracket_match.group(1))
            except json.JSONDecodeError:
                pass

        return None
