import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base, utc_now
from app.db.session import get_db
from app.db.seed_loader import load_seed_data
from app.db.models.content import Course, Chapter
from app.db.models.practice import ChapterTest, Question, TestAttempt
from app.agents.teacher_copilot import TeacherCopilotAgent


@pytest.fixture
async def test_env():
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
        yield client, session_factory

    app.dependency_overrides.clear()
    await test_engine.dispose()


def test_teacher_copilot_star_calculation():
    # Insufficient data
    res_insuf = TeacherCopilotAgent.calculate_course_stars([0.8, 0.9], min_attempts=5)
    assert res_insuf["status"] == "insufficient_data"
    assert res_insuf["rating_value"] is None

    # Sufficient data with perfect scores (mean_ratio = 1.0 -> 5.0 stars)
    res_perfect = TeacherCopilotAgent.calculate_course_stars([1.0, 1.0, 1.0, 1.0, 1.0], min_attempts=5)
    assert res_perfect["status"] == "published"
    assert res_perfect["rating_value"] == 5.0

    # Sufficient data with 50% score (mean_ratio = 0.5 -> 1 + 4*0.5 = 3.0 stars)
    res_half = TeacherCopilotAgent.calculate_course_stars([0.5, 0.5, 0.5, 0.5, 0.5], min_attempts=5)
    assert res_half["status"] == "published"
    assert res_half["rating_value"] == 3.0

    # Narrative generation citing numbers
    metrics = {
        "enrolled_students": 12,
        "completed_first_attempts": 10,
        "avg_first_attempt_score": 82.5,
        "total_reattempts": 6,
        "struggling_students_count": 2,
    }
    narrative = TeacherCopilotAgent.generate_narrative_summary(metrics)
    assert "12 students enrolled" in narrative
    assert "82.5%" in narrative
    assert "6 mastery re-attempts" in narrative
    assert "2 student(s) triggered cognitive friction" in narrative


@pytest.mark.asyncio
async def test_timed_test_first_attempt_rule_and_reattempts(test_env):
    client, session_factory = test_env

    # 1. Register teacher and create course + chapter + chapter test
    teacher_payload = {
        "email": "dr_sharma@adaptai.edu",
        "password": "Password123!",
        "display_name": "Dr. Sharma",
        "role": "teacher",
    }
    t_res = await client.post("/api/v1/auth/register", json=teacher_payload)
    t_token = t_res.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    c_res = await client.post(
        "/api/v1/courses",
        json={"title": "Cell Biology", "subject": "Science", "age_band_code": "11-15", "description": "Intro to Cells"},
        headers=t_headers,
    )
    assert c_res.status_code == 201
    course_id = c_res.json()["id"]
    await client.patch(f"/api/v1/courses/{course_id}", headers=t_headers, json={"is_published": True})

    ch_res = await client.post(
        f"/api/v1/courses/{course_id}/chapters",
        json={"title": "Cell Structure", "sequence_order": 1},
        headers=t_headers,
    )
    chapter_id = ch_res.json()["id"]

    # Directly create ChapterTest with questions in db
    async with session_factory() as db:
        test = ChapterTest(chapter_id=chapter_id, time_limit_seconds=600)
        db.add(test)
        await db.commit()
        await db.refresh(test)

        q1 = Question(
            parent_type="chapter_test",
            parent_id=test.id,
            prompt="What organelle produces ATP?",
            question_type="mcq",
            options=[{"key": "A", "text": "Mitochondria"}, {"key": "B", "text": "Ribosome"}],
            correct_answer={"key": "A", "text": "Mitochondria"},
            explanation="Mitochondria produces ATP",
        )
        q2 = Question(
            parent_type="chapter_test",
            parent_id=test.id,
            prompt="Plant outer wall made of?",
            question_type="mcq",
            options=[{"key": "A", "text": "Cellulose"}, {"key": "B", "text": "Chitin"}],
            correct_answer={"key": "A", "text": "Cellulose"},
            explanation="Cell wall is made of cellulose",
        )
        db.add_all([q1, q2])
        await db.commit()
        chapter_test_id = test.id

    # 2. Register Student
    student_payload = {
        "email": "student_test1@adaptai.org",
        "password": "Password123!",
        "display_name": "Test Student 1",
        "role": "student",
        "age": 12,
        "disability_type_code": "adhd",
    }
    s_res = await client.post("/api/v1/auth/register", json=student_payload)
    s_token = s_res.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    # 3. Start First Attempt
    start_res1 = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=s_headers)
    assert start_res1.status_code == 201
    att1 = start_res1.json()
    assert att1["attempt_number"] == 1
    assert att1["is_first_attempt"] is True
    assert len(att1["questions"]) == 2
    # Ensure correct answers are NOT exposed to student during attempt
    assert "correct_answer" not in att1["questions"][0]

    # 4. Submit First Attempt
    submit_payload1 = {
        "answers": [
            {"question_id": att1["questions"][0]["id"], "selected_key": "A"},
            {"question_id": att1["questions"][1]["id"], "selected_key": "A"},
        ]
    }
    sub_res1 = await client.post(f"/api/v1/attempts/{att1['attempt_id']}/submit", json=submit_payload1, headers=s_headers)
    assert sub_res1.status_code == 200
    res1 = sub_res1.json()
    assert res1["is_first_attempt"] is True
    assert res1["score"] == 2.0
    assert res1["score_percentage"] == 100.0
    assert res1["is_late"] is False

    # 5. Start Second Attempt (Mastery Re-attempt for learning per PROJECT.md §10.7)
    start_res2 = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=s_headers)
    assert start_res2.status_code == 201
    att2 = start_res2.json()
    assert att2["attempt_number"] == 2
    assert att2["is_first_attempt"] is False  # Must be strictly False!

    # 6. Submit Second Attempt
    submit_payload2 = {
        "answers": [
            {"question_id": att2["questions"][0]["id"], "selected_key": "A"},
            {"question_id": att2["questions"][1]["id"], "selected_key": "B"},
        ]
    }
    sub_res2 = await client.post(f"/api/v1/attempts/{att2['attempt_id']}/submit", json=submit_payload2, headers=s_headers)
    assert sub_res2.status_code == 200
    res2 = sub_res2.json()
    assert res2["is_first_attempt"] is False
    assert res2["score"] == 1.0


@pytest.mark.asyncio
async def test_first_attempt_only_feeds_ratings_and_analytics(test_env):
    client, session_factory = test_env

    # Setup Course and Chapter Test
    teacher_payload = {
        "email": "teacher_rating@adaptai.edu",
        "password": "Password123!",
        "display_name": "Prof. Rao",
        "role": "teacher",
    }
    t_res = await client.post("/api/v1/auth/register", json=teacher_payload)
    t_token = t_res.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    c_res = await client.post(
        "/api/v1/courses",
        json={"title": "Chemistry 101", "subject": "Chemistry", "age_band_code": "11-15", "description": "Atoms"},
        headers=t_headers,
    )
    assert c_res.status_code == 201
    course_id = c_res.json()["id"]
    await client.patch(f"/api/v1/courses/{course_id}", headers=t_headers, json={"is_published": True})

    ch_res = await client.post(
        f"/api/v1/courses/{course_id}/chapters",
        json={"title": "Atomic Structure", "sequence_order": 1},
        headers=t_headers,
    )
    chapter_id = ch_res.json()["id"]

    async with session_factory() as db:
        test = ChapterTest(chapter_id=chapter_id, time_limit_seconds=1200)
        db.add(test)
        await db.commit()
        await db.refresh(test)
        q = Question(
            parent_type="chapter_test",
            parent_id=test.id,
            prompt="Protons have positive charge?",
            question_type="mcq",
            options=[{"key": "A", "text": "True"}, {"key": "B", "text": "False"}],
            correct_answer={"key": "A", "text": "True"},
        )
        db.add(q)
        await db.commit()
        chapter_test_id = test.id
        q_id = q.id

    # Register 5 distinct students and enrol them
    student_tokens = []
    for i in range(5):
        s_payload = {
            "email": f"stud_{i}@adaptai.org",
            "password": "Password123!",
            "display_name": f"Student {i}",
            "role": "student",
            "age": 13,
            "disability_type_code": "dyslexia",
        }
        res = await client.post("/api/v1/auth/register", json=s_payload)
        tok = res.json()["access_token"]
        # Enrol in course
        await client.post(f"/api/v1/courses/{course_id}/enrol", headers={"Authorization": f"Bearer {tok}"})
        student_tokens.append(tok)

    # 4 students score 100% on first attempt (1.0), 1 student scores 0% (0.0)
    # Mean ratio = 4.0 / 5 = 0.80
    # Expected rating = 1.0 + 4.0 * 0.80 = 4.2 stars
    for i, tok in enumerate(student_tokens):
        h = {"Authorization": f"Bearer {tok}"}
        start = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=h)
        att_id = start.json()["attempt_id"]
        chosen_key = "A" if i < 4 else "B"
        await client.post(
            f"/api/v1/attempts/{att_id}/submit",
            json={"answers": [{"question_id": q_id, "selected_key": chosen_key}]},
            headers=h,
        )

    # Check rating endpoint
    r_res = await client.get(f"/api/v1/courses/{course_id}/rating")
    assert r_res.status_code == 200
    r_data = r_res.json()
    assert r_data["status"] == "published"
    assert r_data["computed_from_attempt_count"] == 5
    assert r_data["rating_value"] == 4.2

    # Now the 5th student retries 3 times scoring 100% (reattempts for learning)
    h5 = {"Authorization": f"Bearer {student_tokens[4]}"}
    for _ in range(3):
        re_start = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=h5)
        re_att_id = re_start.json()["attempt_id"]
        assert re_start.json()["is_first_attempt"] is False
        await client.post(
            f"/api/v1/attempts/{re_att_id}/submit",
            json={"answers": [{"question_id": q_id, "selected_key": "A"}]},
            headers=h5,
        )

    # Check that course rating is STILL exactly 4.2 and has NOT been inflated by reattempts!
    r_res2 = await client.get(f"/api/v1/courses/{course_id}/rating")
    assert r_res2.status_code == 200
    assert r_res2.json()["rating_value"] == 4.2
    assert r_res2.json()["computed_from_attempt_count"] == 5

    # Check Teacher Analytics endpoint
    analytics_res = await client.get(f"/api/v1/courses/{course_id}/analytics", headers=t_headers)
    assert analytics_res.status_code == 200
    a_data = analytics_res.json()
    assert a_data["enrolled_students"] == 5
    assert a_data["completed_first_attempts"] == 5
    assert a_data["total_reattempts"] == 3
    assert a_data["avg_first_attempt_score"] == 80.0
    assert a_data["rating"]["rating_value"] == 4.2
    assert "80.0%" in a_data["copilot_summary"]
    assert "3 mastery re-attempts" in a_data["copilot_summary"]
