import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.agents  # Registers all 6 agents
from app.db.base import Base
from app.db.models.identity import User, Student
from app.db.models.adaptation import ConsentLedger, StudentPreference, TrustProfile
from app.llm.decision_layer import RequestContext, Decision, Proposal, DecisionLayer
from app.mcp.router import MCPRouter
from app.engine.priority_engine import PriorityEngine
from app.engine.consent_ledger import ConsentLedgerEngine


@pytest.fixture
async def test_session():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_mcp_routing_and_intent_resolution():
    ctx = RequestContext(
        user_id="user_123",
        role="student",
        student_id="student_123",
        disability_types=["dyslexia"],
        age_band="11-15",
    )

    # 1. Decision Layer maps UI action
    decision = DecisionLayer.decide(ctx, action="request_hint")
    assert decision.intent == "request_hint"

    # 2. MCP Router dispatches to registered ZPDHintAgent
    responses = await MCPRouter.route(ctx, decision, {"modality": "audio", "scaffold_level": "partial_hint"})
    assert len(responses) == 1
    assert responses[0].agent_name == "zpd_hint"
    assert responses[0].status == "success"
    assert "hint_text" in responses[0].data

    proposals = MCPRouter.extract_proposals(responses)
    assert len(proposals) == 1
    assert proposals[0].type == "scaffold_change"


@pytest.mark.asyncio
async def test_priority_engine_hierarchy_and_conflict_resolution():
    # Setup proposals across different priority classes
    p_nudge = Proposal(
        agent="nudge_agent",
        type="encouragement",
        priority_class="nudge",
        payload={"message": "You are doing great!"},
        rationale="Pacing support",
        confidence=0.5,
    )
    p_pedagogy = Proposal(
        agent="zpd_hint",
        type="scaffold_change",
        priority_class="pedagogy",
        payload={"level": "partial_hint"},
        rationale="Gradual scaffolding",
        confidence=0.8,
    )
    p_safety = Proposal(
        agent="struggle_detection",
        type="scaffold_change",  # Same type as pedagogy -> conflict!
        priority_class="safety",
        payload={"level": "worked_example_break"},
        rationale="Sensory overload relief",
        confidence=0.9,
    )

    # Case A: Safety outranks pedagogy and resolves conflict for same type
    resolved = PriorityEngine.resolve([p_nudge, p_pedagogy, p_safety], declined_cooldown_types=set())
    assert len(resolved) == 2  # 1 scaffold_change (safety wins) + 1 encouragement
    assert resolved[0].priority_class == "safety"
    assert resolved[0].payload["level"] == "worked_example_break"
    assert resolved[1].priority_class == "nudge"

    # Case B: Cooldown drops non-safety proposal
    resolved_with_cooldown = PriorityEngine.resolve(
        [p_nudge, p_safety],
        declined_cooldown_types={"encouragement"},
    )
    assert len(resolved_with_cooldown) == 1
    assert resolved_with_cooldown[0].type == "scaffold_change"
    assert resolved_with_cooldown[0].priority_class == "safety"


@pytest.mark.asyncio
async def test_consent_ledger_append_only_and_cooldown(test_session: AsyncSession):
    # Setup user and student
    user = User(email="learner@adaptai.edu", password_hash="hash", role="student")
    test_session.add(user)
    await test_session.flush()

    student = Student(user_id=user.id, display_name="Dev", age=14)
    test_session.add(student)
    await test_session.commit()

    proposal = Proposal(
        agent="struggle_detection",
        type="break_suggestion",
        priority_class="pedagogy",
        payload={"minutes": 5},
        requires_consent=True,
        rationale="Offer cognitive pause",
    )

    # 1. Record pending proposal
    pending_row = await ConsentLedgerEngine.record_pending_proposal(test_session, student.id, proposal)
    assert pending_row.status == "pending"
    assert pending_row.supersedes_id is None

    # Check pending list
    pending_list = await ConsentLedgerEngine.get_pending_proposals(test_session, student.id)
    assert len(pending_list) == 1
    assert pending_list[0].id == pending_row.id

    # 2. Student declines proposal -> new row appended
    declined_row = await ConsentLedgerEngine.record_decision(
        test_session,
        student_id=student.id,
        ledger_id=pending_row.id,
        decision="declined",
        decided_by="student",
    )
    assert declined_row.status == "declined"
    assert declined_row.supersedes_id == pending_row.id

    # Pending list is now empty because it was superseded
    pending_after = await ConsentLedgerEngine.get_pending_proposals(test_session, student.id)
    assert len(pending_after) == 0

    # Cooldown should now be active for break_suggestion
    cooldowns = await ConsentLedgerEngine.get_active_cooldown_types(test_session, student.id, cooldown_minutes=30)
    assert "break_suggestion" in cooldowns

    # 3. New approved proposal of type modality_switch
    prop2 = Proposal(
        agent="zpd_hint",
        type="modality_switch",
        priority_class="pedagogy",
        payload={"preferred_modality": "audio"},
        requires_consent=True,
        rationale="Offer audio support",
    )
    pending_prop2 = await ConsentLedgerEngine.record_pending_proposal(test_session, student.id, prop2)

    approved_row = await ConsentLedgerEngine.record_decision(
        test_session,
        student_id=student.id,
        ledger_id=pending_prop2.id,
        decision="approved",
        decided_by="student",
    )
    assert approved_row.status == "approved"
    assert approved_row.supersedes_id == pending_prop2.id

    # Verify student preference updated
    pref_res = await test_session.execute(
        select(StudentPreference).where(
            StudentPreference.student_id == student.id,
            StudentPreference.key == "modality_switch",
        )
    )
    pref = pref_res.scalar_one()
    assert pref.value["preferred_modality"] == "audio"

    # Verify trust profile has 1 accepted and 1 declined
    tp_res = await test_session.execute(select(TrustProfile).where(TrustProfile.student_id == student.id))
    tp = tp_res.scalar_one()
    assert tp.accepted_count == 1
    assert tp.declined_count == 1

    # Verify total rows in ledger (4 rows total: 2 pending + 1 declined + 1 approved; append-only guarantee)
    ledger_count_res = await test_session.execute(select(ConsentLedger).where(ConsentLedger.student_id == student.id))
    all_rows = ledger_count_res.scalars().all()
    assert len(all_rows) == 4
