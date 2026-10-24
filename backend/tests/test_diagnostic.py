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
async def test_student_onboarding_diagnostic_and_placement_flow(async_client: AsyncClient):
    # 1. Teacher creates and publishes age 11-15 course
    t_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "diag_teacher@adaptai.edu", "password": "password123", "role": "teacher", "display_name": "Prof. Rao"},
    )
    t_headers = {"Authorization": f"Bearer {t_res.json()['access_token']}"}

    c_res = await async_client.post(
        "/api/v1/courses",
        headers=t_headers,
        json={"title": "Middle School Exploratory Science", "subject": "Science", "age_band_code": "11-15"},
    )
    course_id = c_res.json()["id"]

    await async_client.patch(
        f"/api/v1/courses/{course_id}",
        headers=t_headers,
        json={"is_published": True},
    )

    # 2. Student registers with disability
    s_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_diagnostic@example.com",
            "password": "password123",
            "role": "student",
            "display_name": "Tarun",
            "age": 13,
            "disability_type_code": "asd",
        },
    )
    assert s_res.status_code == 201
    s_data = s_res.json()
    s_token = s_data["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # Inspect student profile to obtain student_id
    me_res = await async_client.get("/api/v1/auth/me", headers=s_headers)
    student_id = me_res.json()["student_id"]
    assert student_id is not None

    # 3. Student starts diagnostic onboarding
    diag_start_res = await async_client.post(
        f"/api/v1/students/{student_id}/diagnostic/start",
        headers=s_headers,
    )
    assert diag_start_res.status_code == 201
    start_data = diag_start_res.json()
    diagnostic_id = start_data["diagnostic_id"]
    questions = start_data["questions"]
    assert len(questions) >= 1

    # 4. Student submits answers
    submissions = []
    for q in questions:
        submissions.append({
            "question_id": q["id"],
            "selected_key": q["correct_answer"]["key"],  # Submit correct key
            "time_taken_ms": 3500,
        })

    submit_res = await async_client.post(
        f"/api/v1/diagnostic/{diagnostic_id}/submit",
        headers=s_headers,
        json={"answers": submissions},
    )
    assert submit_res.status_code == 200
    res_data = submit_res.json()
    assert res_data["score"] > 0
    assert res_data["percentage"] == 100.0
    assert res_data["recommended_course_id"] == course_id
    assert res_data["recommended_course_title"] == "Middle School Exploratory Science"

    # 5. Get recommendation view
    rec_res = await async_client.get(
        f"/api/v1/diagnostic/{diagnostic_id}/recommendation",
        headers=s_headers,
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["recommended_course_id"] == course_id

    # 6. Student enrols in the recommended course
    enrol_res = await async_client.post(
        f"/api/v1/courses/{course_id}/enrol",
        headers=s_headers,
    )
    assert enrol_res.status_code == 201
    enrol_data = enrol_res.json()
    assert enrol_data["course_id"] == course_id
    assert enrol_data["status"] == "active"

    # 7. Check student enrolments list
    enrol_list_res = await async_client.get(
        f"/api/v1/students/{student_id}/enrolments",
        headers=s_headers,
    )
    assert enrol_list_res.status_code == 200
    enrols = enrol_list_res.json()
    assert len(enrols) == 1
    assert enrols[0]["course_id"] == course_id
