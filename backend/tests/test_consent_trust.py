import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.seed_loader import load_seed_data
from app.agents.consent_trust import ConsentTrustAgent
from app.llm.decision_layer import Proposal
from app.engine.consent_ledger import ConsentLedgerEngine


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


def test_consent_trust_agent_prompts_and_metrics():
    # 1. Plain language formatting for 7-10 vs 11-15
    title_young, rat_young, act_young = ConsentTrustAgent.format_plain_language_prompt(
        proposal_type="scaffold_change",
        proposal_payload={"scaffold_level": "worked_example"},
        age_band="7-10",
    )
    assert "Step-by-Step" in title_young
    assert "tricky" in rat_young

    title_older, rat_older, _ = ConsentTrustAgent.format_plain_language_prompt(
        proposal_type="scaffold_change",
        proposal_payload={"scaffold_level": "worked_example"},
        age_band="11-15",
    )
    assert "Scaffolded" in title_older

    # 2. Modality switch prompt
    title_audio, rat_audio, _ = ConsentTrustAgent.format_plain_language_prompt(
        proposal_type="modality_switch",
        proposal_payload={"modality": "audio"},
        age_band="11-15",
    )
    assert "Audio" in title_audio

    # 3. Trust metrics calculation
    rate, factor, reduce_nudges = ConsentTrustAgent.compute_trust_metrics(accepted_count=4, declined_count=1)
    assert rate == 0.80
    assert factor == 1.0
    assert reduce_nudges is False

    # Frequent declines should trigger nagging reduction
    rate_low, factor_low, reduce_nudges_low = ConsentTrustAgent.compute_trust_metrics(accepted_count=1, declined_count=4)
    assert rate_low == 0.20
    assert factor_low == 0.5
    assert reduce_nudges_low is True


@pytest.mark.asyncio
async def test_consent_end_to_end_flow(test_env):
    client, session_factory = test_env

    # 1. Register student
    reg_payload = {
        "email": "student_consent_e2e@adaptai.org",
        "password": "Password123!",
        "display_name": "Consent Test Student",
        "role": "student",
        "age": 13,
        "disability_type_code": "adhd",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_res = await client.get("/api/v1/auth/me", headers=headers)
    student_id = me_res.json()["student_id"]

    # 2. Directly insert a pending proposal using ConsentLedgerEngine
    proposal = Proposal(
        agent="zpd_hint",
        type="scaffold_change",
        priority_class="pedagogy",
        payload={"scaffold_level": "worked_example"},
        requires_consent=True,
        rationale="Multi-step difficulty detected",
    )
    async with session_factory() as db:
        pending_item = await ConsentLedgerEngine.record_pending_proposal(db, student_id, proposal)
        pending_ledger_id = pending_item.id

    # 3. Query GET /students/{id}/consent/pending
    pending_res = await client.get(f"/api/v1/students/{student_id}/consent/pending", headers=headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert len(pending_list) >= 1
    target_proposal = next(p for p in pending_list if p["ledger_id"] == pending_ledger_id)
    assert "plain_title" in target_proposal
    assert "plain_rationale" in target_proposal
    assert target_proposal["proposal_type"] == "scaffold_change"

    # 4. Approve adaptation via POST /consent/{ledger_id}/decide
    decide_payload = {
        "decision": "approved",
        "decided_by": "student",
    }
    decide_res = await client.post(f"/api/v1/consent/{pending_ledger_id}/decide", json=decide_payload, headers=headers)
    assert decide_res.status_code == 200
    decision_record = decide_res.json()
    assert decision_record["status"] == "approved"
    assert decision_record["supersedes_id"] == pending_ledger_id

    # 5. Verify preference was saved in GET /students/{id}/preferences
    pref_res = await client.get(f"/api/v1/students/{student_id}/preferences", headers=headers)
    assert pref_res.status_code == 200
    prefs = pref_res.json()
    assert any(p["key"] == "scaffold_change" for p in prefs)

    # 6. Verify trust profile updated
    tp_res = await client.get(f"/api/v1/students/{student_id}/trust-profile", headers=headers)
    assert tp_res.status_code == 200
    tp_data = tp_res.json()
    assert tp_data["accepted_count"] == 1
    assert tp_data["declined_count"] == 0
    assert tp_data["acceptance_rate"] == 1.0

    # 7. Revoke preference via POST /students/{id}/consent/revoke
    revoke_payload = {
        "preference_key": "scaffold_change",
        "decided_by": "student",
    }
    revoke_res = await client.post(f"/api/v1/students/{student_id}/consent/revoke", json=revoke_payload, headers=headers)
    assert revoke_res.status_code == 200
    revoke_record = revoke_res.json()
    assert revoke_record["status"] == "declined"
    assert revoke_record["supersedes_id"] == decision_record["id"]

    # 8. Verify preference is now removed
    pref_res2 = await client.get(f"/api/v1/students/{student_id}/preferences", headers=headers)
    assert pref_res2.status_code == 200
    assert not any(p["key"] == "scaffold_change" for p in pref_res2.json())

    # 9. Verify full audit trail in GET /students/{id}/consent/history
    hist_res = await client.get(f"/api/v1/students/{student_id}/consent/history", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 3  # pending -> approved -> declined/revoked
    assert history[0]["status"] == "declined"  # latest is the revocation
