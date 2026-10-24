import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi.testclient import TestClient

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data
from app.ml.features import extract_behavioural_features
from app.ml.struggle_model import StruggleModel
from app.agents.struggle_detection import StruggleDetectionAgent
from app.agents.base import AgentRequest
from app.llm.decision_layer import RequestContext


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


def test_extract_behavioural_features():
    signals = [
        {"signal_type": "response_latency", "value": {"time_taken_ms": 25000}},
        {"signal_type": "input_hesitation", "value": {"idle_time_ms": 9000, "option_changes": 2}},
        {"signal_type": "hint_request", "value": {"hints_used": 2, "escalated": True}},
    ]
    responses = [
        {"question_id": "q1", "is_correct": False, "time_taken_ms": 20000, "hints_used": 1},
        {"question_id": "q2", "is_correct": False, "time_taken_ms": 30000, "hints_used": 1},
    ]

    features = extract_behavioural_features(signals, responses, student_baseline_latency_ms=15000.0, student_baseline_hesitation_ms=5000.0)

    assert features["consecutive_errors"] == 2
    assert features["error_rate"] == 1.0
    assert features["latency_ratio"] > 1.0
    assert features["hesitation_ratio"] > 1.0
    assert features["total_hints"] == 2
    assert features["hint_escalations"] == 1


def test_struggle_model_scoring_thresholds():
    # Low risk
    low_features = {
        "error_rate": 0.0,
        "consecutive_errors": 0,
        "repeat_errors": 0,
        "latency_ratio": 0.9,
        "hesitation_ratio": 0.8,
        "total_hints": 0,
        "total_edits": 0,
    }
    score, risk, factors = StruggleModel.predict(low_features)
    assert score < 0.40
    assert risk == "low"

    # Medium risk
    med_features = {
        "error_rate": 0.5,
        "consecutive_errors": 2,
        "repeat_errors": 0,
        "latency_ratio": 1.4,
        "hesitation_ratio": 1.2,
        "total_hints": 1,
        "total_edits": 2,
    }
    score, risk, factors = StruggleModel.predict(med_features)
    assert risk == "medium"
    assert any("consecutive" in f for f in factors)

    # High risk (cognitive overload / struggle)
    high_features = {
        "error_rate": 1.0,
        "consecutive_errors": 3,
        "repeat_errors": 1,
        "latency_ratio": 2.5,
        "hesitation_ratio": 2.2,
        "total_hints": 3,
        "total_edits": 4,
    }
    score, risk, factors = StruggleModel.predict(high_features)
    assert score >= 0.70
    assert risk == "high"


@pytest.mark.asyncio
async def test_struggle_detection_agent_proposals():
    agent = StruggleDetectionAgent()
    ctx = RequestContext(
        user_id="u1",
        role="student",
        student_id="s1",
        disability_types=["adhd"],
        age_band="11-15",
    )

    # High risk should emit safety break_suggestion
    high_req = AgentRequest(
        agent_name=agent.name,
        intent="assess_struggle",
        payload={"risk_level": "high", "struggle_score": 0.88, "contributing_factors": ["High latency"]},
    )
    high_res = await agent.handle(ctx, high_req)
    assert high_res.status == "success"
    assert len(high_res.proposals) >= 1
    assert high_res.proposals[0].priority_class == "safety"
    assert high_res.proposals[0].type == "break_suggestion"
    assert high_res.proposals[0].requires_consent is False

    # Medium risk should emit pedagogy scaffold_change requiring consent
    med_req = AgentRequest(
        agent_name=agent.name,
        intent="assess_struggle",
        payload={"risk_level": "medium", "struggle_score": 0.55, "contributing_factors": ["2 errors"]},
    )
    med_res = await agent.handle(ctx, med_req)
    assert med_res.status == "success"
    assert any(p.priority_class == "pedagogy" for p in med_res.proposals)
    assert any(p.requires_consent is True for p in med_res.proposals)


@pytest.mark.asyncio
async def test_telemetry_signals_and_assess_api(async_client: AsyncClient):
    # Register student
    reg_payload = {
        "email": "telemetry_student@adaptai.org",
        "password": "Password123!",
        "display_name": "Telemetry Student",
        "role": "student",
        "age": 13,
        "disability_type_code": "adhd",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post batch telemetry signals
    signals_payload = {
        "signals": [
            {
                "session_ref": "practice-session-001",
                "signal_type": "response_latency",
                "value": {"time_taken_ms": 28000, "question_id": "q1"},
            },
            {
                "session_ref": "practice-session-001",
                "signal_type": "input_hesitation",
                "value": {"idle_time_ms": 12000, "option_changes": 3},
            },
            {
                "session_ref": "practice-session-001",
                "signal_type": "error_pattern",
                "value": {"is_correct": False, "streak": 2},
            },
        ]
    }
    sig_res = await async_client.post("/api/v1/telemetry/signals", json=signals_payload, headers=headers)
    assert sig_res.status_code == 201
    saved_signals = sig_res.json()
    assert len(saved_signals) == 3

    # 2. Assess struggle
    assess_payload = {
        "session_ref": "practice-session-001",
        "signals": [
            {
                "session_ref": "practice-session-001",
                "signal_type": "hint_request",
                "value": {"hints_used": 2, "escalated": True},
            }
        ],
    }
    assess_res = await async_client.post("/api/v1/struggle/assess", json=assess_payload, headers=headers)
    assert assess_res.status_code == 200
    assessment = assess_res.json()
    assert "score" in assessment
    assert "risk_level" in assessment
    assert assessment["risk_level"] in ["low", "medium", "high"]
    assert len(assessment["proposals"]) >= 1

    # 3. Retrieve struggle history
    student_id = assessment["student_id"]
    hist_res = await async_client.get(f"/api/v1/students/{student_id}/struggle/history", headers=headers)
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert len(hist_data) >= 1
    assert hist_data[0]["id"] == assessment["id"]


@pytest.mark.asyncio
async def test_websocket_telemetry_flow(async_client: AsyncClient):
    # Register student to get auth token
    reg_payload = {
        "email": "ws_student@adaptai.org",
        "password": "Password123!",
        "display_name": "WS Student",
        "role": "student",
        "age": 14,
        "disability_type_code": "asd",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]

    client = TestClient(app)
    with client.websocket_connect("/api/v1/ws/session") as ws:
        # Handshake with token
        ws.send_json({"token": token})
        auth_ack = ws.receive_json()
        assert auth_ack["type"] == "authenticated"

        # Stream a signal
        ws.send_json({
            "type": "signal",
            "session_ref": "ws-session-001",
            "signal_type": "input_hesitation",
            "value": {"idle_time_ms": 8000, "option_changes": 2},
        })
        ack = ws.receive_json()
        assert ack["type"] == "signal_ack"
        assert "signal_id" in ack

        # Trigger struggle assessment over WebSocket
        ws.send_json({
            "type": "assess",
            "session_ref": "ws-session-001",
        })
        assessment_msg = ws.receive_json()
        assert assessment_msg["type"] == "struggle_assessment"
        assert "data" in assessment_msg
        assert "risk_level" in assessment_msg["data"]
