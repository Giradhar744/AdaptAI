import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data


@pytest.fixture
async def e2e_client():
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
async def test_full_system_e2e_acceptance_loop(e2e_client: AsyncClient):
    """PROJECT.md §12.4 Complete End-to-End Acceptance Test:
    Teacher creates course + chapter + topic + lecture
    -> generates DPP and Chapter Test
    -> student registers with disability (ADHD)
    -> diagnostic onboarding -> placed -> enrols
    -> watches lecture
    -> AI-guided DPP with multimodal audio/text hint
    -> struggle detected -> adaptation proposal accepted and ledgered in append-only ledger
    -> chapter test first attempt scored
    -> voluntary reattempt scored for mastery
    -> teacher dashboard shows first attempt only in rating and acknowledges reattempt.
    """
    client = e2e_client

    # =========================================================================
    # Step 1: Teacher Registration & Authentication
    # =========================================================================
    teacher_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr_curie@adaptai.edu",
            "password": "TeacherPassword123!",
            "role": "teacher",
            "display_name": "Dr. Marie Curie",
        },
    )
    assert teacher_reg.status_code == 201
    t_token = teacher_reg.json()["access_token"]
    t_headers = {"Authorization": f"Bearer {t_token}"}

    # =========================================================================
    # Step 2: Teacher creates Course + Chapter + Topic + Lecture
    # =========================================================================
    course_res = await client.post(
        "/api/v1/courses",
        headers=t_headers,
        json={
            "title": "Fundamental Cell Biology & Genetics",
            "subject": "Biology",
            "age_band_code": "11-15",
            "description": "Sensory-conscious and neurodivergent-friendly biological foundations.",
        },
    )
    assert course_res.status_code == 201
    course_id = course_res.json()["id"]

    chapter_res = await client.post(
        f"/api/v1/courses/{course_id}/chapters",
        headers=t_headers,
        json={"title": "Chapter 1: The Microscopic Living Cell"},
    )
    assert chapter_res.status_code == 201
    chapter_id = chapter_res.json()["id"]

    topic_res = await client.post(
        f"/api/v1/chapters/{chapter_id}/topics",
        headers=t_headers,
        json={
            "title": "Cell Membrane & Mitochondria",
            "content_text": "The mitochondria is often referred to as the powerhouse of the cell, generating adenosine triphosphate (ATP) through cellular respiration.",
        },
    )
    assert topic_res.status_code == 201
    topic_id = topic_res.json()["id"]

    # Request lecture upload URL & create Lecture
    upload_res = await client.post(
        f"/api/v1/chapters/{chapter_id}/lectures/upload-url",
        headers=t_headers,
        json={"filename": "cell_intro.mp4", "content_type": "video/mp4"},
    )
    assert upload_res.status_code == 200
    video_id = upload_res.json()["video_id"]

    lecture_res = await client.post(
        "/api/v1/lectures",
        headers=t_headers,
        json={
            "chapter_id": chapter_id,
            "title": "Tour Inside the Living Cell",
            "video_ref": video_id,
            "duration_seconds": 600,
        },
    )
    assert lecture_res.status_code == 201
    lecture_data = lecture_res.json()
    assert "playback_url" in lecture_data

    # =========================================================================
    # Step 3: Teacher generates Daily Practice Problems (DPP) & Chapter Test
    # =========================================================================
    dpp_res = await client.post(
        f"/api/v1/topics/{topic_id}/dpp/generate",
        headers=t_headers,
    )
    assert dpp_res.status_code == 201
    dpp_data = dpp_res.json()
    dpp_id = dpp_data["id"]
    dpp_questions = dpp_data["questions"]
    assert len(dpp_questions) >= 1
    dpp_q1 = dpp_questions[0]

    test_res = await client.post(
        f"/api/v1/chapters/{chapter_id}/test/generate",
        headers=t_headers,
    )
    assert test_res.status_code == 201
    test_data = test_res.json()
    chapter_test_id = test_data["id"]
    assert test_data["questions_count"] >= 1

    # Publish course for student discovery & placement
    publish_res = await client.patch(
        f"/api/v1/courses/{course_id}",
        headers=t_headers,
        json={"is_published": True},
    )
    assert publish_res.status_code == 200
    assert publish_res.json()["is_published"] is True

    # =========================================================================
    # Step 4: Student registers with Disability Profile (ADHD, Age 13 -> 11-15)
    # =========================================================================
    student_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "maya_student@adaptai.org",
            "password": "StudentPassword123!",
            "role": "student",
            "display_name": "Maya",
            "age": 13,
            "disability_type_code": "adhd",
        },
    )
    assert student_reg.status_code == 201
    s_token = student_reg.json()["access_token"]
    s_headers = {"Authorization": f"Bearer {s_token}"}

    me_res = await client.get("/api/v1/auth/me", headers=s_headers)
    assert me_res.status_code == 200
    student_id = me_res.json()["student_id"]
    assert student_id is not None

    # =========================================================================
    # Step 5: Student Diagnostic Onboarding & Algorithmic Course Placement
    # =========================================================================
    diag_start = await client.post(
        f"/api/v1/students/{student_id}/diagnostic/start",
        headers=s_headers,
    )
    assert diag_start.status_code == 201
    diag_data = diag_start.json()
    diag_id = diag_data["diagnostic_id"]
    diag_questions = diag_data["questions"]
    assert len(diag_questions) >= 1

    # Submit diagnostic answers
    diag_answers = [
        {"question_id": q["id"], "selected_key": q["options"][0]["key"], "time_taken_ms": 12000}
        for q in diag_questions
    ]
    diag_submit = await client.post(
        f"/api/v1/diagnostic/{diag_id}/submit",
        headers=s_headers,
        json={"answers": diag_answers},
    )
    assert diag_submit.status_code == 200
    placement_data = diag_submit.json()
    assert placement_data["recommended_course_id"] == course_id

    # Enrol in recommended course
    enrol_res = await client.post(
        f"/api/v1/courses/{course_id}/enrol",
        headers=s_headers,
    )
    assert enrol_res.status_code == 201

    # =========================================================================
    # Step 6: Student watches Lecture
    # =========================================================================
    lectures_res = await client.get(f"/api/v1/chapters/{chapter_id}/lectures", headers=s_headers)
    assert lectures_res.status_code == 200
    course_lectures = lectures_res.json()
    assert len(course_lectures) >= 1
    assert course_lectures[0]["playback_url"] is not None

    # =========================================================================
    # Step 7: AI-Guided DPP Practice with Multimodal Hint (Audio & Text)
    # =========================================================================
    practice_session_res = await client.post(
        f"/api/v1/dpp/{dpp_id}/sessions",
        headers=s_headers,
        json={"mode": "ai_guided"},
    )
    assert practice_session_res.status_code == 201
    session_id = practice_session_res.json()["session_id"]

    # Request scaffolded hint with audio synthesis
    hint_res = await client.post(
        f"/api/v1/dpp-sessions/{session_id}/hint",
        headers=s_headers,
        json={
            "question_id": dpp_q1["id"],
            "modality": "audio",
            "current_depth": "partial_hint",
        },
    )
    assert hint_res.status_code == 200
    hint_data = hint_res.json()
    assert hint_data["hint_text"] is not None
    assert hint_data["audio_base64"] is not None
    assert hint_data["media_type"] == "audio/wav"

    # Submit practice response (moderate friction error triggering pedagogy scaffolding proposal)
    dpp_ans_res = await client.post(
        f"/api/v1/dpp-sessions/{session_id}/responses",
        headers=s_headers,
        json={
            "question_id": dpp_q1["id"],
            "answer": {"selected_key": "B"},
            "time_taken_ms": 22000,
            "hints_used": 1,
        },
    )
    assert dpp_ans_res.status_code == 200

    # =========================================================================
    # Step 8: Telemetry Stream & Struggle Assessment -> Adaptation Proposal
    # =========================================================================
    # Ingest behavioural signals indicating moderate friction (score ~0.57 -> medium risk)
    telemetry_payload = {
        "signals": [
            {
                "session_ref": session_id,
                "signal_type": "input_hesitation",
                "value": {"idle_time_ms": 8000, "option_changes": 2},
            },
            {
                "session_ref": session_id,
                "signal_type": "response_latency",
                "value": {"time_taken_ms": 22000},
            },
            {
                "session_ref": session_id,
                "signal_type": "hint_request",
                "value": {"hints_used": 1, "escalated": False},
            },
        ]
    }
    sig_res = await client.post("/api/v1/telemetry/signals", headers=s_headers, json=telemetry_payload)
    assert sig_res.status_code == 201

    # Trigger real-time struggle assessment
    assess_res = await client.post(
        "/api/v1/struggle/assess",
        headers=s_headers,
        json={"session_ref": session_id, "signals": telemetry_payload["signals"]},
    )
    assert assess_res.status_code == 200
    assessment = assess_res.json()
    assert assessment["score"] > 0.0
    assert len(assessment["proposals"]) >= 1

    # =========================================================================
    # Step 9: Consent Decision Center -> Student Approves Adaptation Proposal
    # =========================================================================
    pending_res = await client.get(f"/api/v1/students/{student_id}/consent/pending", headers=s_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert len(pending_list) >= 1
    proposal_to_decide = pending_list[0]
    ledger_id = proposal_to_decide["ledger_id"]
    assert proposal_to_decide["plain_title"] is not None
    assert proposal_to_decide["plain_rationale"] is not None

    # Student explicitly approves proposal
    decide_res = await client.post(
        f"/api/v1/consent/{ledger_id}/decide",
        headers=s_headers,
        json={"decision": "approved", "decided_by": "student"},
    )
    assert decide_res.status_code == 200
    decided_record = decide_res.json()
    assert decided_record["status"] == "approved"
    assert decided_record["supersedes_id"] == ledger_id

    # Verify student preference was automatically synced
    pref_res = await client.get(f"/api/v1/students/{student_id}/preferences", headers=s_headers)
    assert pref_res.status_code == 200
    assert len(pref_res.json()) >= 1

    # Verify trust profile recorded the accepted proposal
    trust_res = await client.get(f"/api/v1/students/{student_id}/trust-profile", headers=s_headers)
    assert trust_res.status_code == 200
    assert trust_res.json()["accepted_count"] >= 1

    # =========================================================================
    # Step 10: Timed Chapter Test — Attempt 1 (First Attempt Rule: Only this scores)
    # =========================================================================
    start_att1 = await client.post(
        f"/api/v1/chapter-tests/{chapter_test_id}/attempts",
        headers=s_headers,
    )
    assert start_att1.status_code == 201
    att1_data = start_att1.json()
    assert att1_data["attempt_number"] == 1
    assert att1_data["is_first_attempt"] is True
    test_questions = att1_data["questions"]
    assert len(test_questions) >= 1

    # First attempt: Answer with 1st option
    submit_att1 = await client.post(
        f"/api/v1/attempts/{att1_data['attempt_id']}/submit",
        headers=s_headers,
        json={
            "answers": [
                {"question_id": q["id"], "selected_key": q["options"][0]["key"]}
                for q in test_questions
            ]
        },
    )
    assert submit_att1.status_code == 200
    att1_result = submit_att1.json()
    assert att1_result["is_first_attempt"] is True
    first_attempt_score = att1_result["score"]
    first_attempt_percentage = att1_result["score_percentage"]

    # =========================================================================
    # Step 11: Timed Chapter Test — Attempt 2 (Mastery Re-Attempt for Learning)
    # =========================================================================
    start_att2 = await client.post(
        f"/api/v1/chapter-tests/{chapter_test_id}/attempts",
        headers=s_headers,
    )
    assert start_att2.status_code == 201
    att2_data = start_att2.json()
    assert att2_data["attempt_number"] == 2
    assert att2_data["is_first_attempt"] is False  # Must strictly be False!

    # Re-attempt: Submit feedback-informed answers for all questions
    sub2_answers = [
        {"question_id": fb["question_id"], "selected_key": fb["correct_key"]}
        for fb in att1_result["feedback"]
    ]
    submit_att2 = await client.post(
        f"/api/v1/attempts/{att2_data['attempt_id']}/submit",
        headers=s_headers,
        json={"answers": sub2_answers},
    )
    assert submit_att2.status_code == 200
    att2_result = submit_att2.json()
    assert att2_result["is_first_attempt"] is False
    assert att2_result["score_percentage"] == 100.0  # Perfect mastery achieved

    # =========================================================================
    # Step 12: Teacher Dashboard & Star Rating Verification
    # =========================================================================
    # 1. Course Rating isolation
    rating_res = await client.get(f"/api/v1/courses/{course_id}/rating", headers=t_headers)
    assert rating_res.status_code == 200
    rating_data = rating_res.json()
    # Exactly 1 first attempt recorded (the voluntary reattempt is excluded from rating count)
    assert rating_data["computed_from_attempt_count"] == 1

    # 2. Teacher Analytics & Co-Pilot Narrative
    analytics_res = await client.get(f"/api/v1/courses/{course_id}/analytics", headers=t_headers)
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()

    assert analytics_data["enrolled_students"] == 1
    assert analytics_data["completed_first_attempts"] == 1
    assert analytics_data["total_reattempts"] == 1
    assert analytics_data["avg_first_attempt_score"] == pytest.approx(first_attempt_percentage, 0.1)

    # Validate student roster reflects first attempt vs latest mastery attempt
    roster = analytics_data["students_summary"]
    assert len(roster) == 1
    student_entry = roster[0]
    assert student_entry["student_name"] == "Maya"
    assert student_entry["attempts_count"] == 2
    assert student_entry["first_attempt_score"] == pytest.approx(first_attempt_percentage, 0.1)
    assert student_entry["latest_attempt_score"] == pytest.approx(att2_result["score_percentage"], 0.1)

    # Validate AI Teacher Co-Pilot narrative synthesis
    copilot_summary = analytics_data["copilot_summary"]
    assert "first-attempt" in copilot_summary
    assert "enrolled" in copilot_summary
    assert "re-attempts" in copilot_summary
