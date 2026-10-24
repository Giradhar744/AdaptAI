from typing import Optional
from app.speech.base import TTSProvider, STTProvider, AudioResult


class FakeTTSProvider:
    """Deterministic TTS Provider returning lightweight mock audio (PROJECT.md §7)."""

    async def synthesize(
        self,
        text: str,
        *,
        voice: Optional[str] = None,
        speed: float = 1.0,
    ) -> AudioResult:
        # 44-byte standard RIFF WAV header representing silence for test playback
        dummy_wav_header = (
            b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
            b"D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        )
        return AudioResult(
            audio_bytes=dummy_wav_header,
            media_type="audio/wav",
            duration_seconds=round(max(1.0, len(text) * 0.05), 1),
            transcript=text,
        )


class FakeSTTProvider:
    """Deterministic STT Provider returning mock transcript (PROJECT.md §7)."""

    async def transcribe(
        self,
        audio: bytes,
        *,
        language: Optional[str] = None,
    ) -> str:
        return "Deterministic transcript: student requested assistance with question 1."
