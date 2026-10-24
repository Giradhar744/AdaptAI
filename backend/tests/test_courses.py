import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

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
async def test_teacher_course_and_lecture_authoring_flow(async_client: AsyncClient):
    # 1. Register teacher
    t_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher_sci@adaptai.edu",
            "password": "password123",
            "role": "teacher",
            "display_name": "Prof. Homi",
        },
    )
    assert t_res.status_code == 201
    t_token = t_res.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # 2. Register student
    s_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_ananya@example.com",
            "password": "password123",
            "role": "student",
            "display_name": "Ananya",
            "age": 13,
            "disability_type_code": "dyslexia",
        },
    )
    assert s_res.status_code == 201
    s_token = s_res.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # 3. Teacher creates a course
    course_res = await async_client.post(
        "/api/v1/courses",
        headers=t_headers,
        json={
            "title": "Natural Sciences",
            "subject": "Physics & Chemistry",
            "age_band_code": "11-15",
            "description": "Accessible, visual-first science curriculum.",
        },
    )
    assert course_res.status_code == 201
    course_data = course_res.json()
    assert course_data["title"] == "Natural Sciences"
    assert course_data["is_published"] is False
    course_id = course_data["id"]

    # 4. Teacher adds Chapter 1
    ch_res = await async_client.post(
        f"/api/v1/courses/{course_id}/chapters",
        headers=t_headers,
        json={"title": "Chapter 1: Heat and Temperature"},
    )
    assert ch_res.status_code == 201
    ch_data = ch_res.json()
    assert ch_data["position"] == 1
    chapter_id = ch_data["id"]

    # 5. Teacher adds Topic to Chapter 1
    top_res = await async_client.post(
        f"/api/v1/chapters/{chapter_id}/topics",
        headers=t_headers,
        json={
            "title": "Conduction and Convection",
            "content_text": "Heat transfers through solids via conduction, where vibrating particles transfer kinetic energy.",
        },
    )
    assert top_res.status_code == 201
    assert top_res.json()["title"] == "Conduction and Convection"

    # 6. Teacher requests lecture upload URL
    upload_res = await async_client.post(
        f"/api/v1/chapters/{chapter_id}/lectures/upload-url",
        headers=t_headers,
        json={"filename": "conduction_demo.mp4", "content_type": "video/mp4"},
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert "upload_url" in upload_data
    video_id = upload_data["video_id"]

    # 7. Teacher creates Lecture record
    lec_res = await async_client.post(
        "/api/v1/lectures",
        headers=t_headers,
        json={
            "chapter_id": chapter_id,
            "title": "Visual Heat Conduction Demonstration",
            "video_ref": video_id,
            "duration_seconds": 320,
        },
    )
    assert lec_res.status_code == 201
    lec_data = lec_res.json()
    assert lec_data["video_ref"] == video_id
    assert "playback_url" in lec_data

    # 8. Course is still unpublished; verify student cannot see it in public list
    pub_list = await async_client.get("/api/v1/courses", headers=s_headers)
    assert pub_list.status_code == 200
    assert len(pub_list.json()) == 0

    # 9. Teacher publishes course
    patch_res = await async_client.patch(
        f"/api/v1/courses/{course_id}",
        headers=t_headers,
        json={"is_published": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_published"] is True

    # 10. Student now sees published course and retrieves details
    pub_list_after = await async_client.get("/api/v1/courses", headers=s_headers)
    assert len(pub_list_after.json()) == 1

    detail_res = await async_client.get(f"/api/v1/courses/{course_id}", headers=s_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["chapters"]) == 1
    assert len(detail["chapters"][0]["topics"]) == 1
    assert len(detail["chapters"][0]["lectures"]) == 1
    assert detail["chapters"][0]["lectures"][0]["playback_url"].endswith(".mp4")


@pytest.mark.asyncio
async def test_course_permission_guardrails(async_client: AsyncClient):
    # Teacher 1
    t1_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "t1@adaptai.edu", "password": "password123", "role": "teacher", "display_name": "T1"},
    )
    assert t1_res.status_code == 201
    t1_headers = {"Authorization": f"Bearer {t1_res.json()['access_token']}"}

    # Teacher 2
    t2_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "t2@adaptai.edu", "password": "password123", "role": "teacher", "display_name": "T2"},
    )
    assert t2_res.status_code == 201
    t2_headers = {"Authorization": f"Bearer {t2_res.json()['access_token']}"}

    # Student
    s_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "s1@example.com", "password": "password123", "role": "student", "display_name": "S1", "age": 10},
    )
    assert s_res.status_code == 201
    s_headers = {"Authorization": f"Bearer {s_res.json()['access_token']}"}

    # Student cannot create a course (403)
    s_create = await async_client.post(
        "/api/v1/courses",
        headers=s_headers,
        json={"title": "Unauthorized", "subject": "Math", "age_band_code": "7-10"},
    )
    assert s_create.status_code == 403

    # Teacher 1 creates course
    course_res = await async_client.post(
        "/api/v1/courses",
        headers=t1_headers,
        json={"title": "Algebra Fundamentals", "subject": "Math", "age_band_code": "11-15"},
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    # Teacher 2 tries to add chapter to Teacher 1's course (403)
    t2_add_ch = await async_client.post(
        f"/api/v1/courses/{course_id}/chapters",
        headers=t2_headers,
        json={"title": "Intruder Chapter"},
    )
    assert t2_add_ch.status_code == 403
