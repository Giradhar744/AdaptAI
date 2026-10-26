from typing import Optional
from app.core.config import settings
from app.llm.providers.openai_provider import OpenAILLMProvider


class NvidiaNIMProvider(OpenAILLMProvider):
    """NVIDIA NIM (Inference Microservices) Provider.
    Connects to NVIDIA's free cloud inference endpoint (https://integrate.api.nvidia.com/v1)
    and supports free fast models including:
      - meta/llama-3.1-8b-instruct (Fast, low-latency, free on NVIDIA NIM)
      - meta/llama-3.3-70b-instruct
      - mistralai/mistral-7b-instruct-v0.3
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        nvidia_key = api_key or settings.NVIDIA_API_KEY or settings.LLM_API_KEY
        nvidia_model = model or (settings.NVIDIA_MODEL if settings.NVIDIA_MODEL else "meta/llama-3.3-70b-instruct")
        if settings.LLM_MODEL and settings.LLM_MODEL != "fake-default":
            nvidia_model = settings.LLM_MODEL

        nvidia_base_url = base_url or settings.NVIDIA_BASE_URL or "https://integrate.api.nvidia.com/v1"

        super().__init__(
            api_key=nvidia_key,
            model=nvidia_model,
            base_url=nvidia_base_url,
        )
