import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.agents
from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data


@pytest.fixture
async def async_client():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as seed_session:
        await load_seed_data(seed_session)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_dpp_session_modes_and_zpd_hint_delivery(async_client: AsyncClient):
    # 1. Teacher setup
    t_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "teacher_dpp@adaptai.edu", "password": "password123", "role": "teacher", "display_name": "Prof. Sen"},
    )
    t_headers = {"Authorization": f"Bearer {t_res.json()['access_token']}"}

    c_res = await async_client.post(
        "/api/v1/courses",
        headers=t_headers,
        json={"title": "Introduction to Physics", "subject": "Physics", "age_band_code": "11-15"},
    )
    course_id = c_res.json()["id"]

    ch_res = await async_client.post(
        f"/api/v1/courses/{course_id}/chapters",
        headers=t_headers,
        json={"title": "Motion and Force"},
    )
    chapter_id = ch_res.json()["id"]

    top_res = await async_client.post(
        f"/api/v1/chapters/{chapter_id}/topics",
        headers=t_headers,
        json={"title": "Newton's First Law", "content_text": "An object at rest stays at rest unless acted upon by an external net force."},
    )
    topic_id = top_res.json()["id"]

    # Generate DPP
    dpp_res = await async_client.post(
        f"/api/v1/topics/{topic_id}/dpp/generate",
        headers=t_headers,
    )
    dpp_id = dpp_res.json()["id"]
    questions = dpp_res.json()["questions"]
    assert len(questions) >= 1
    q1 = questions[0]

    # 2. Student setup (Dyslexia)
    s_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_practice@example.com",
            "password": "password123",
            "role": "student",
            "display_name": "Dev",
            "age": 13,
            "disability_type_code": "dyslexia",
        },
    )
    s_headers = {"Authorization": f"Bearer {s_res.json()['access_token']}"}

    # 3. Start AI-Guided DPP Session
    session_res = await async_client.post(
        f"/api/v1/dpp/{dpp_id}/sessions",
        headers=s_headers,
        json={"mode": "ai_guided"},
    )
    assert session_res.status_code == 201
    s_data = session_res.json()
    session_id = s_data["session_id"]
    assert s_data["mode"] == "ai_guided"

    # 4. Request Text Hint in AI-Guided mode
    hint_res = await async_client.post(
        f"/api/v1/dpp-sessions/{session_id}/hint",
        headers=s_headers,
        json={"question_id": q1["id"], "modality": "text", "current_depth": "partial_hint"},
    )
    assert hint_res.status_code == 200
    h_data = hint_res.json()
    assert "hint_text" in h_data
    assert h_data["scaffold_level"] == "partial_hint"
    assert h_data["modality"] == "text"

    # 5. Request Audio Hint in AI-Guided mode
    audio_hint_res = await async_client.post(
        f"/api/v1/dpp-sessions/{session_id}/hint",
        headers=s_headers,
        json={"question_id": q1["id"], "modality": "audio", "current_depth": "partial_hint"},
    )
    assert audio_hint_res.status_code == 200
    audio_data = audio_hint_res.json()
    assert audio_data["modality"] == "audio"
    assert audio_data["audio_base64"] is not None
    assert audio_data["media_type"] == "audio/wav"

    # 6. Submit Answer to Question 1
    submit_res = await async_client.post(
        f"/api/v1/dpp-sessions/{session_id}/responses",
        headers=s_headers,
        json={
            "question_id": q1["id"],
            "answer": {"selected_key": q1["correct_answer"]["key"]},
            "time_taken_ms": 4200,
            "hints_used": 2,
        },
    )
    assert submit_res.status_code == 200
    sub_data = submit_res.json()
    assert sub_data["is_correct"] is True

    # 7. Start an Independent Session and verify hint rejection
    indep_session = await async_client.post(
        f"/api/v1/dpp/{dpp_id}/sessions",
        headers=s_headers,
        json={"mode": "independent"},
    )
    indep_id = indep_session.json()["session_id"]

    # In independent mode, requesting hint must return 400 Bad Request
    rejected_hint = await async_client.post(
        f"/api/v1/dpp-sessions/{indep_id}/hint",
        headers=s_headers,
        json={"question_id": q1["id"], "modality": "text"},
    )
    assert rejected_hint.status_code == 400
    assert "Independent Practice mode" in rejected_hint.json()["detail"]

    # 8. Check session summary
    summary_res = await async_client.get(
        f"/api/v1/dpp-sessions/{session_id}/summary",
        headers=s_headers,
    )
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_questions"] == 1
    assert summary["correct_count"] == 1
    assert summary["score_percentage"] == 100.0
    assert summary["total_hints_used"] == 2
