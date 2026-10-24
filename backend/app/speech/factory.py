from typing import Optional
from app.core.config import settings
from app.speech.base import TTSProvider, STTProvider
from app.speech.providers.fake import FakeTTSProvider, FakeSTTProvider


def get_tts_provider(provider_name: Optional[str] = None) -> TTSProvider:
    name = (provider_name or settings.TTS_PROVIDER).lower()
    return FakeTTSProvider()


def get_stt_provider(provider_name: Optional[str] = None) -> STTProvider:
    name = (provider_name or settings.STT_PROVIDER).lower()
    return FakeSTTProvider()
