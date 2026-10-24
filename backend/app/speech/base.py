from typing import Protocol, Optional
from pydantic import BaseModel, Field


class AudioResult(BaseModel):
    audio_bytes: bytes = Field(description="Raw audio payload or encoded audio")
    media_type: str = Field(default="audio/wav", description="MIME type of synthesized audio")
    duration_seconds: float = Field(default=2.5, description="Audio duration in seconds")
    transcript: str = Field(description="Text transcript corresponding to the audio")


class TTSProvider(Protocol):
    """Abstract interface for Text-to-Speech synthesis (PROJECT.md §7)."""
    async def synthesize(
        self,
        text: str,
        *,
        voice: Optional[str] = None,
        speed: float = 1.0,
    ) -> AudioResult:
        ...


class STTProvider(Protocol):
    """Abstract interface for Speech-to-Text transcription (PROJECT.md §7)."""
    async def transcribe(
        self,
        audio: bytes,
        *,
        language: Optional[str] = None,
    ) -> str:
        ...
