import pytest
from app.llm.base import Message, LLMProviderError
from app.llm.factory import get_llm_provider, ResilientLLMClient
from app.llm.providers.fake import FakeLLMProvider
from app.speech.factory import get_tts_provider, get_stt_provider
from app.video.factory import get_video_store


@pytest.mark.asyncio
async def test_fake_llm_free_text():
    client = get_llm_provider("fake")
    messages = [
        Message(role="system", content="You are a pedagogical assistant."),
        Message(role="user", content="Explain states of water to a 10 year old."),
    ]
    result = await client.complete(messages)
    assert result.text is not None
    assert len(result.text) > 0
    assert result.latency_ms >= 0
    assert "total_tokens" in result.token_usage


@pytest.mark.asyncio
async def test_fake_llm_structured_schema_dpp():
    client = get_llm_provider("fake")
    schema = {
        "type": "object",
        "required": ["questions"],
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["prompt", "question_type", "options", "correct_answer"],
                    "properties": {
                        "prompt": {"type": "string"},
                        "question_type": {"type": "string"},
                        "options": {"type": "array"},
                        "correct_answer": {"type": "object"},
                    },
                },
            }
        },
    }

    messages = [
        Message(role="user", content="Generate DPP questions for topic states of matter"),
    ]
    result = await client.complete(messages, json_schema=schema)
    assert result.parsed is not None
    assert "questions" in result.parsed
    assert len(result.parsed["questions"]) >= 1
    q = result.parsed["questions"][0]
    assert "prompt" in q
    assert "options" in q
    assert "correct_answer" in q


@pytest.mark.asyncio
async def test_nvidia_nim_provider_instantiation():
    from app.llm.providers.nvidia_provider import NvidiaNIMProvider
    provider = NvidiaNIMProvider(api_key="nvapi-test123")
    assert provider.endpoint == "https://integrate.api.nvidia.com/v1/chat/completions"
    assert provider.model in ["meta/llama-3.3-70b-instruct", "nvidia/nemotron-3.5-super-vl-120b-a12b"]
    assert provider.api_key == "nvapi-test123"


@pytest.mark.asyncio
async def test_llm_retry_on_transient_failure():
    # Provider fails on first attempt, succeeds on second attempt
    fake_provider = FakeLLMProvider(failure_count=1)
    resilient_client = ResilientLLMClient(provider=fake_provider, max_retries=2, timeout=5.0)

    messages = [Message(role="user", content="Test retry")]
    result = await resilient_client.complete(messages)
    assert result.text is not None
    assert fake_provider.call_count == 2  # Proves 1 retry happened


@pytest.mark.asyncio
async def test_llm_exhausted_retries_raises_typed_error():
    # Provider fails on all attempts
    fake_provider = FakeLLMProvider(failure_count=5)
    resilient_client = ResilientLLMClient(provider=fake_provider, max_retries=2, timeout=5.0)

    messages = [Message(role="user", content="Test failure")]
    with pytest.raises(LLMProviderError) as exc_info:
        await resilient_client.complete(messages)

    assert "LLM call failed after 3 attempts" in str(exc_info.value)


@pytest.mark.asyncio
async def test_speech_providers():
    tts = get_tts_provider("fake")
    result = await tts.synthesize("Take a look at the third option", voice="calm", speed=0.9)
    assert len(result.audio_bytes) > 0
    assert result.media_type == "audio/wav"
    assert result.transcript == "Take a look at the third option"

    stt = get_stt_provider("fake")
    transcript = await stt.transcribe(result.audio_bytes)
    assert isinstance(transcript, str)
    assert len(transcript) > 0


@pytest.mark.asyncio
async def test_video_store():
    video_store = get_video_store("fake")
    upload = await video_store.create_upload("intro_to_matter.mp4", "video/mp4")
    assert upload.video_id.startswith("vid_")
    assert upload.content_type == "video/mp4"

    stream_url = video_store.playback_ref(upload.video_id)
    assert upload.video_id in stream_url
    assert stream_url.endswith(".mp4")
