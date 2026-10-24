import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.agents  # Ensure agents registered in MCP
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
async def test_topic_dpp_and_chapter_test_generation_flow(async_client: AsyncClient):
    # 1. Register teacher
    t_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher_gen@adaptai.edu",
            "password": "password123",
            "role": "teacher",
            "display_name": "Prof. Bose",
        },
    )
    assert t_res.status_code == 201
    t_token = t_res.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # 2. Register student
    s_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_kavya@example.com",
            "password": "password123",
            "role": "student",
            "display_name": "Kavya",
            "age": 12,
            "disability_type_code": "asd",
        },
    )
    assert s_res.status_code == 201
    s_token = s_res.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # 3. Create Course -> Chapter -> Topic
    course_res = await async_client.post(
        "/api/v1/courses",
        headers=t_headers,
        json={
            "title": "Thermodynamics and Matter",
            "subject": "Physical Science",
            "age_band_code": "11-15",
            "description": "Sensory-tailored concepts on states of matter.",
        },
    )
    course_id = course_res.json()["id"]

    ch_res = await async_client.post(
        f"/api/v1/courses/{course_id}/chapters",
        headers=t_headers,
        json={"title": "Chapter 1: States of Matter"},
    )
    chapter_id = ch_res.json()["id"]

    top_res = await async_client.post(
        f"/api/v1/chapters/{chapter_id}/topics",
        headers=t_headers,
        json={
            "title": "Properties of Steam and Water",
            "content_text": "Steam is the invisible gaseous form of water produced when water boils at 100 degrees Celsius.",
        },
    )
    topic_id = top_res.json()["id"]

    # 4. Trigger one-click DPP generation (Teacher only)
    dpp_res = await async_client.post(
        f"/api/v1/topics/{topic_id}/dpp/generate",
        headers=t_headers,
    )
    assert dpp_res.status_code == 201
    dpp_data = dpp_res.json()
    assert dpp_data["topic_id"] == topic_id
    assert dpp_data["generated_by"] == "llm"
    assert dpp_data["questions_count"] >= 1

    first_q = dpp_data["questions"][0]
    assert "prompt" in first_q
    assert len(first_q["options"]) >= 2
    assert first_q["correct_answer"]["key"] in [opt["key"] for opt in first_q["options"]]
    dpp_id = dpp_data["id"]

    # 5. Student retrieves generated DPP
    s_dpp_res = await async_client.get(
        f"/api/v1/topics/{topic_id}/dpp",
        headers=s_headers,
    )
    assert s_dpp_res.status_code == 200
    assert s_dpp_res.json()["id"] == dpp_id

    # 6. Teacher updates DPP status to draft
    patch_dpp = await async_client.patch(
        f"/api/v1/dpps/{dpp_id}",
        headers=t_headers,
        json={"status": "draft"},
    )
    assert patch_dpp.status_code == 200
    assert patch_dpp.json()["status"] == "draft"

    # 7. Teacher triggers chapter test generation
    test_res = await async_client.post(
        f"/api/v1/chapters/{chapter_id}/test/generate",
        headers=t_headers,
    )
    assert test_res.status_code == 201
    test_data = test_res.json()
    assert test_data["chapter_id"] == chapter_id
    assert test_data["time_limit_seconds"] > 0
    assert test_data["questions_count"] >= 1
    test_id = test_data["id"]

    # 8. Student retrieves chapter test
    s_test_res = await async_client.get(
        f"/api/v1/chapters/{chapter_id}/test",
        headers=s_headers,
    )
    assert s_test_res.status_code == 200
    assert s_test_res.json()["id"] == test_id

    # 9. Guard check: Student cannot trigger DPP generation (403)
    s_gen_dpp = await async_client.post(
        f"/api/v1/topics/{topic_id}/dpp/generate",
        headers=s_headers,
    )
    assert s_gen_dpp.status_code == 403
