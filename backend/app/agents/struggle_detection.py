from typing import ClassVar, Set
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.decision_layer import RequestContext, Proposal
from app.mcp.registry import registry
from app.ml.struggle_model import StruggleModel


class StruggleDetectionAgent(BaseAgent):
    name: ClassVar[str] = "struggle_detection"
    intents: ClassVar[Set[str]] = {"assess_struggle"}
    feature_flag_attr: ClassVar[str] = "AGENT_STRUGGLE_ENABLED"

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        features = req.payload.get("features", {})
        risk_level = req.payload.get("risk_level")
        struggle_score = req.payload.get("struggle_score")
        contributing_factors = req.payload.get("contributing_factors", [])

        # If score and risk_level are not precomputed, compute via StruggleModel
        if struggle_score is None or risk_level is None:
            struggle_score, risk_level, factors = StruggleModel.predict(features)
            if not contributing_factors:
                contributing_factors = factors

        proposals = []

        if risk_level == "high":
            # Safety priority class: offers a sensory break to relieve cognitive/sensory overload (PROJECT.md §9.3 & §10.5)
            factors_text = (
                f" ({', '.join(contributing_factors)})"
                if contributing_factors
                else ""
            )
            proposals.append(
                Proposal(
                    agent=self.name,
                    type="break_suggestion",
                    priority_class="safety",
                    payload={
                        "duration_minutes": 5,
                        "reason": "high_cognitive_load",
                        "action": "offer_break",
                        "factors": contributing_factors,
                    },
                    requires_consent=False,
                    rationale=f"Noticed signs of high cognitive fatigue or sensory overload{factors_text}. Recommending a 5-minute calming pause.",
                    confidence=0.95,
                )
            )
        elif risk_level == "medium":
            # Pedagogy priority class: propose reducing scaffolding depth to worked example (requires student consent)
            proposals.append(
                Proposal(
                    agent=self.name,
                    type="scaffold_change",
                    priority_class="pedagogy",
                    payload={
                        "scaffold_level": "worked_example",
                        "action": "reduce_scaffold_depth",
                        "factors": contributing_factors,
                    },
                    requires_consent=True,
                    rationale="Challenging steps detected. Proposing a step-by-step worked example to support your understanding.",
                    confidence=0.85,
                )
            )
        else:
            # Low risk: gentle encouragement nudge
            proposals.append(
                Proposal(
                    agent=self.name,
                    type="encouragement_nudge",
                    priority_class="nudge",
                    payload={"message": "You're making steady, focused progress! Keep up the great work."},
                    requires_consent=False,
                    rationale="Steady focus and progress observed.",
                    confidence=0.70,
                )
            )

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={
                "struggle_score": struggle_score,
                "risk_level": risk_level,
                "features": features,
                "contributing_factors": contributing_factors,
            },
            proposals=proposals,
        )


struggle_detection_agent = StruggleDetectionAgent()
registry.register(struggle_detection_agent)
