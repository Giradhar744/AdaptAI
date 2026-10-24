import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi import APIRouter, Depends

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data
from app.core.deps import require_teacher

# Route for role-guard verification (avoid test_ prefix for router variable)
guard_router = APIRouter()


@guard_router.get("/api/v1/test-teacher-only")
async def teacher_only_endpoint(current_user=Depends(require_teacher)):
    return {"message": f"Welcome teacher {current_user.email}"}


app.include_router(guard_router)


@pytest.fixture
async def async_client():
    """Sets up an in-memory database with seed data and returns an authenticated test client."""
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
async def test_teacher_register_login_and_me(async_client: AsyncClient):
    # 1. Register teacher
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "teacher1@adaptai.edu",
            "password": "securepassword123",
            "role": "teacher",
            "display_name": "Dr. Sarah Rao",
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["role"] == "teacher"
    assert "access_token" in data

    token = data["access_token"]

    # 2. Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "teacher1@adaptai.edu", "password": "securepassword123"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["role"] == "teacher"
    assert login_data["display_name"] == "Dr. Sarah Rao"

    # 3. GET /me
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "teacher1@adaptai.edu"
    assert me_data["teacher_id"] is not None
    assert me_data["role"] == "teacher"

    # 4. Access teacher-only protected endpoint
    guard_res = await async_client.get(
        "/api/v1/test-teacher-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert guard_res.status_code == 200


@pytest.mark.asyncio
async def test_student_register_with_disability_and_age_placement(async_client: AsyncClient):
    # Register student with ADHD, age 15 (should resolve to 11-15 per PROJECT.md §15.2)
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student1@example.com",
            "password": "studentpassword123",
            "role": "student",
            "display_name": "Rohan",
            "age": 15,
            "disability_type_code": "adhd",
        },
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["role"] == "student"

    token = data["access_token"]

    # Inspect /auth/me
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["student_id"] is not None
    assert me_data["age"] == 15
    assert "11–15" in (me_data["age_band"] or "")
    assert len(me_data["disabilities"]) == 1
    assert me_data["disabilities"][0]["code"] == "adhd"

    # Attempt to access teacher-only route with student token (should be 403 Forbidden)
    forbidden_res = await async_client.get(
        "/api/v1/test-teacher-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_auth_rejection_on_invalid_credentials_and_duplicates(async_client: AsyncClient):
    # Invalid password
    bad_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "wrong"},
    )
    assert bad_login.status_code == 401

    # Register user
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "password123",
            "role": "teacher",
            "display_name": "First User",
        },
    )

    # Duplicate registration should return 409
    dup_res = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "password123",
            "role": "teacher",
            "display_name": "Duplicate User",
        },
    )
    assert dup_res.status_code == 409


@pytest.mark.asyncio
async def test_reference_data_endpoints(async_client: AsyncClient):
    # Disability types
    dt_res = await async_client.get("/api/v1/reference/disability-types")
    assert dt_res.status_code == 200
    dts = dt_res.json()
    assert len(dts) == 4
    codes = [d["code"] for d in dts]
    assert "asd" in codes
    assert "adhd" in codes
    assert "dyslexia" in codes
    assert "other_idd" in codes

    # Age bands
    ab_res = await async_client.get("/api/v1/reference/age-bands")
    assert ab_res.status_code == 200
    abs_data = ab_res.json()
    assert len(abs_data) == 3
