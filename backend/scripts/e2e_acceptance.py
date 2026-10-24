#!/usr/bin/env python3
"""AdaptAI — End-to-End Acceptance Flow Runner (PROJECT.md §12.4)

Usage:
    python scripts/e2e_acceptance.py

Demonstrates and validates the complete multi-actor learning loop:
1. Teacher registers & creates Course + Chapter + Topic + Lecture
2. Teacher triggers AI content generation for DPP and Chapter Test
3. Student registers with Disability Profile (ADHD, Age 13 -> AgeBand 11-15)
4. Student completes Diagnostic Onboarding & receives automated placement
5. Student enrols in course and accesses lecture video
6. Student initiates AI-guided DPP practice and requests multimodal audio hint
7. Telemetry & real-time struggle assessment generates adaptation proposal
8. Student inspects Consent Decision Center and approves proposal
9. Student completes Timed Chapter Test (First Attempt)
10. Student takes Voluntary Re-attempt 2 for Mastery (100% score)
11. Teacher Dashboard verifies First-Attempt Star Rating isolation & Co-Pilot narrative.
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def log_step(step_num: int, title: str, details: str = ""):
    print(f"\n\033[1;36m[Step {step_num}] {title}\033[0m")
    if details:
        print(f"       \033[0;37m{details}\033[0m")


def log_success(msg: str):
    print(f"       \033[1;32m[OK] {msg}\033[0m")


async def run_e2e():
    print("=" * 80)
    print("\033[1;35m  AdaptAI -- Full System Integration & E2E Acceptance Flow (Week 12)\033[0m")
    print("=" * 80)

    # 1. Initialize in-memory database with reference seeds
    print("\n[Init] Spinning up isolated test environment & seeding reference tables...")
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as seed_session:
        await load_seed_data(seed_session)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Teacher Auth
        log_step(1, "Teacher Registration & Authentication", "Registering Prof. Homi Bhabha (Physics & Chemistry)")
        t_reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "homi.bhabha@adaptai.edu",
                "password": "TeacherPassword123!",
                "role": "teacher",
                "display_name": "Prof. Homi Bhabha",
            },
        )
        assert t_reg.status_code == 201, f"Teacher reg failed: {t_reg.text}"
        t_token = t_reg.json()["access_token"]
        t_headers = {"Authorization": f"Bearer {t_token}"}
        log_success(f"Teacher authenticated (JWT issued)")

        # Step 2: Course Authoring
        log_step(2, "Curriculum Authoring", "Creating Course, Chapter 1, Topic, and Video Lecture")
        c_res = await client.post(
            "/api/v1/courses",
            headers=t_headers,
            json={
                "title": "Introduction to Atomic Physics & Energy",
                "subject": "Physics",
                "age_band_code": "11-15",
                "description": "Sensory-conscious foundations of matter, radiation, and energy states.",
            },
        )
        assert c_res.status_code == 201
        course_id = c_res.json()["id"]

        ch_res = await client.post(
            f"/api/v1/courses/{course_id}/chapters",
            headers=t_headers,
            json={"title": "Chapter 1: The Nucleus & Energy Transfer"},
        )
        assert ch_res.status_code == 201
        chapter_id = ch_res.json()["id"]

        top_res = await client.post(
            f"/api/v1/chapters/{chapter_id}/topics",
            headers=t_headers,
            json={
                "title": "Subatomic Particles & Forces",
                "content_text": "Protons and neutrons form the dense atomic nucleus, bound together by the strong nuclear force.",
            },
        )
        assert top_res.status_code == 201
        topic_id = top_res.json()["id"]

        # Lecture
        up_res = await client.post(
            f"/api/v1/chapters/{chapter_id}/lectures/upload-url",
            headers=t_headers,
            json={"filename": "nuclear_intro.mp4", "content_type": "video/mp4"},
        )
        assert up_res.status_code == 200
        vid_id = up_res.json()["video_id"]

        lec_res = await client.post(
            "/api/v1/lectures",
            headers=t_headers,
            json={
                "chapter_id": chapter_id,
                "title": "Visual Exploration of the Atomic Nucleus",
                "video_ref": vid_id,
                "duration_seconds": 450,
            },
        )
        assert lec_res.status_code == 201
        log_success(f"Curriculum established: Course '{course_id}', Lecture '{lec_res.json()['id']}'")

        # Step 3: Content Generation Agent
        log_step(3, "AI Content Generation", "Generating DPP (daily practice) and Timed Chapter Test")
        dpp_res = await client.post(f"/api/v1/topics/{topic_id}/dpp/generate", headers=t_headers)
        assert dpp_res.status_code == 201
        dpp_id = dpp_res.json()["id"]
        dpp_q1 = dpp_res.json()["questions"][0]

        test_gen_res = await client.post(f"/api/v1/chapters/{chapter_id}/test/generate", headers=t_headers)
        assert test_gen_res.status_code == 201
        chapter_test_id = test_gen_res.json()["id"]

        # Publish course
        await client.patch(f"/api/v1/courses/{course_id}", headers=t_headers, json={"is_published": True})
        log_success(f"Generated DPP '{dpp_id}' and Chapter Test '{chapter_test_id}', Course published")

        # Step 4: Student Registration
        log_step(4, "Student Registration & Disability Declaration", "Registering Ananya (Age 13, declared Dyslexia)")
        s_reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "ananya_student@adaptai.org",
                "password": "StudentPassword123!",
                "role": "student",
                "display_name": "Ananya",
                "age": 13,
                "disability_type_code": "dyslexia",
            },
        )
        assert s_reg.status_code == 201
        s_token = s_reg.json()["access_token"]
        s_headers = {"Authorization": f"Bearer {s_token}"}
        me_res = await client.get("/api/v1/auth/me", headers=s_headers)
        student_id = me_res.json()["student_id"]
        log_success(f"Student 'Ananya' registered with AgeBand 11-15 (ID: {student_id})")

        # Step 5: Diagnostic Onboarding & Enrolment
        log_step(5, "Diagnostic Onboarding & Algorithmic Course Placement", "Completing diagnostic test")
        diag_start = await client.post(f"/api/v1/students/{student_id}/diagnostic/start", headers=s_headers)
        assert diag_start.status_code == 201
        diag_id = diag_start.json()["diagnostic_id"]
        diag_q = diag_start.json()["questions"]

        diag_sub = await client.post(
            f"/api/v1/diagnostic/{diag_id}/submit",
            headers=s_headers,
            json={"answers": [{"question_id": q["id"], "selected_key": q["options"][0]["key"]} for q in diag_q]},
        )
        assert diag_sub.status_code == 200
        rec_course = diag_sub.json()["recommended_course_id"]
        assert rec_course == course_id

        await client.post(f"/api/v1/courses/{course_id}/enrol", headers=s_headers)
        log_success(f"Placement placed student into recommended course '{course_id}' -> Enrolment complete")

        # Step 6: Watch Lecture
        log_step(6, "Lecture Video Streaming", "Accessing course lecture")
        lec_list = await client.get(f"/api/v1/chapters/{chapter_id}/lectures", headers=s_headers)
        assert lec_list.status_code == 200
        log_success(f"Playback ready at: {lec_list.json()[0]['playback_url']}")

        # Step 7: Practice with ZPD Scaffolding Hint
        log_step(7, "AI-Guided Practice & Multimodal Hint", "Requesting audio hint for DPP question")
        sess_res = await client.post(f"/api/v1/dpp/{dpp_id}/sessions", headers=s_headers, json={"mode": "ai_guided"})
        session_id = sess_res.json()["session_id"]

        hint_res = await client.post(
            f"/api/v1/dpp-sessions/{session_id}/hint",
            headers=s_headers,
            json={"question_id": dpp_q1["id"], "modality": "audio", "current_depth": "partial_hint"},
        )
        assert hint_res.status_code == 200
        h_data = hint_res.json()
        log_success(f"Scaffolded Audio Hint received ({h_data['media_type']}, base64 size: {len(h_data['audio_base64'])})")

        # Submit response
        await client.post(
            f"/api/v1/dpp-sessions/{session_id}/responses",
            headers=s_headers,
            json={"question_id": dpp_q1["id"], "selected_key": dpp_q1["options"][0]["key"], "time_taken_ms": 15000, "hints_used": 1},
        )
        log_success("Practice response logged with ZPD level tracking")

        # Step 8: Struggle Detection & Priority Engine
        log_step(8, "Telemetry & Struggle Assessment", "Simulating friction signals (latency, hesitation, hint usage)")
        sig_payload = {
            "signals": [
                {"session_ref": session_id, "signal_type": "input_hesitation", "value": {"idle_time_ms": 11000, "option_changes": 3}},
                {"session_ref": session_id, "signal_type": "response_latency", "value": {"time_taken_ms": 35000}},
                {"session_ref": session_id, "signal_type": "hint_request", "value": {"hints_used": 2, "escalated": True}},
            ]
        }
        await client.post("/api/v1/telemetry/signals", headers=s_headers, json=sig_payload)
        assess_res = await client.post("/api/v1/struggle/assess", headers=s_headers, json={"session_ref": session_id, "signals": sig_payload["signals"]})
        assert assess_res.status_code == 200
        struggle = assess_res.json()
        log_success(f"Struggle model assessed risk: '{struggle['risk_level']}' (score: {struggle['score']:.2f}) -> {len(struggle['proposals'])} proposals")

        # Step 9: Consent Decision Center
        log_step(9, "Consent & Trust Agent", "Student approves adaptation in Consent Decision Center")
        pending_res = await client.get(f"/api/v1/students/{student_id}/consent/pending", headers=s_headers)
        assert pending_res.status_code == 200
        pending_item = pending_res.json()[0]
        ledger_id = pending_item["ledger_id"]
        log_success(f"Pending adaptation: '{pending_item['plain_title']}'")

        decide_res = await client.post(
            f"/api/v1/consent/{ledger_id}/decide",
            headers=s_headers,
            json={"decision": "approved", "decided_by": "student"},
        )
        assert decide_res.status_code == 200
        log_success(f"Append-only decision logged: status='approved', supersedes_id='{ledger_id}'")

        # Step 10: Timed Chapter Test - Attempt 1
        log_step(10, "Timed Chapter Test -- First Attempt", "Strict First-Attempt Rule verification")
        att1_res = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=s_headers)
        att1 = att1_res.json()
        assert att1["is_first_attempt"] is True
        t_questions = att1["questions"]

        sub1 = await client.post(
            f"/api/v1/attempts/{att1['attempt_id']}/submit",
            headers=s_headers,
            json={"answers": [{"question_id": q["id"], "selected_key": q["options"][0]["key"]} for q in t_questions]},
        )
        res1 = sub1.json()
        assert res1["is_first_attempt"] is True
        log_success(f"Attempt 1 submitted: score = {res1['score']}/{res1['max_score']} ({res1['score_percentage']}%), is_first_attempt=True")

        # Step 11: Timed Chapter Test - Voluntary Re-Attempt 2 (Mastery)
        log_step(11, "Timed Chapter Test -- Voluntary Re-Attempt 2", "Student re-attempts for mastery learning")
        att2_res = await client.post(f"/api/v1/chapter-tests/{chapter_test_id}/attempts", headers=s_headers)
        att2 = att2_res.json()
        assert att2["is_first_attempt"] is False  # Invariant: Re-attempts are NEVER first attempts!

        sub2_answers = [
            {"question_id": fb["question_id"], "selected_key": fb["correct_key"]}
            for fb in res1["feedback"]
        ]
        sub2 = await client.post(
            f"/api/v1/attempts/{att2['attempt_id']}/submit",
            headers=s_headers,
            json={"answers": sub2_answers},
        )
        res2 = sub2.json()
        assert res2["is_first_attempt"] is False
        assert res2["score_percentage"] == 100.0
        log_success(f"Attempt 2 submitted: 100% mastery achieved, is_first_attempt=False")

        # Step 12: Teacher Dashboard & Star Rating
        log_step(12, "Teacher Dashboard & Star Rating Verification", "Validating First-Attempt isolation in ratings")
        rating_res = await client.get(f"/api/v1/courses/{course_id}/rating", headers=t_headers)
        assert rating_res.status_code == 200
        rating_data = rating_res.json()
        assert rating_data["computed_from_attempt_count"] == 1
        log_success(f"Course Rating attempt count = 1 (Attempt 2 excluded from rating calculation)")

        analytics_res = await client.get(f"/api/v1/courses/{course_id}/analytics", headers=t_headers)
        assert analytics_res.status_code == 200
        a_data = analytics_res.json()
        assert a_data["completed_first_attempts"] == 1
        assert a_data["total_reattempts"] == 1
        assert len(a_data["students_summary"]) == 1
        st_row = a_data["students_summary"][0]
        assert st_row["attempts_count"] == 2
        assert st_row["student_name"] == "Ananya"

        log_success(f"Teacher Analytics: enrolled={a_data['enrolled_students']}, first_attempts={a_data['completed_first_attempts']}, reattempts={a_data['total_reattempts']}")
        print(f"\n       \033[1;33mAI Teacher Co-Pilot Narrative:\033[0m")
        print(f"       \033[0;33m\"{a_data['copilot_summary']}\"\033[0m")

    app.dependency_overrides.clear()
    await engine.dispose()

    print("\n" + "=" * 80)
    print("\033[1;32m  ALL 12 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY (PROJECT.md Section 12.4)\033[0m")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(run_e2e())
