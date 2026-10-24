from typing import ClassVar, Set, Dict, Any, Tuple
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.decision_layer import RequestContext, Proposal
from app.mcp.registry import registry


class ConsentTrustAgent(BaseAgent):
    name: ClassVar[str] = "consent_trust"
    intents: ClassVar[Set[str]] = {"propose_adaptation", "record_consent"}
    feature_flag_attr: ClassVar[str] = "AGENT_CONSENT_ENABLED"

    @classmethod
    def format_plain_language_prompt(
        cls,
        proposal_type: str,
        proposal_payload: Dict[str, Any],
        age_band: str = "11-15",
        disability_type: str | None = None,
    ) -> Tuple[str, str, str]:
        """
        Converts an agent adaptation proposal into a transparent, plain-language,
        non-coercive prompt suited to the student's age band (PROJECT.md §10.6).
        """
        is_young = age_band == "7-10"

        if proposal_type == "scaffold_change":
            level = proposal_payload.get("scaffold_level", "worked_example")
            if level == "worked_example":
                title = "Try a Step-by-Step Example" if is_young else "Scaffolded Worked Example Support"
                rationale = (
                    "This problem seems tricky. Would you like to see a guided example showing how to solve a similar question first?"
                    if is_young
                    else "We noticed this topic involves multiple steps. Would you like to review a step-by-step worked example before attempting similar questions?"
                )
                action = "Switch practice mode to Step-by-Step Worked Example"
            else:
                title = "Adjust Question Guidance"
                rationale = "Would you like more guidance or hints on upcoming practice questions?"
                action = f"Set scaffolding level to {level}"

        elif proposal_type == "break_suggestion":
            title = "Time for a Calming Break" if is_young else "Sensory & Cognitive Pause"
            duration = proposal_payload.get("duration_minutes", 5)
            rationale = (
                f"You've been working hard! Would you like to take a gentle {duration}-minute break to rest your eyes and stretch?"
                if is_young
                else f"Noticed signs of cognitive fatigue. We recommend taking a {duration}-minute sensory pause to restore mental clarity."
            )
            action = f"Start a {duration}-minute sensory break"

        elif proposal_type == "modality_switch":
            target = proposal_payload.get("modality", "audio")
            title = "Audio Read-Aloud Hints" if target == "audio" else "Text Hints"
            rationale = (
                "Would you like us to read your hints out loud using spoken audio?"
                if target == "audio"
                else "Would you prefer reading hints on screen instead of audio narration?"
            )
            action = f"Change hint modality to {target}"

        else:
            title = "Learning Adaptation Proposal"
            rationale = "AdaptAI has suggested an adjustment to make learning smoother. You can approve or decline."
            action = f"Apply adaptation: {proposal_type}"

        return title, rationale, action

    @classmethod
    def compute_trust_metrics(cls, accepted_count: int, declined_count: int) -> Tuple[float, float, bool]:
        """
        Computes acceptance rate and nagging reduction factor (PROJECT.md §10.6 & §15.9).
        The metric is strictly used to reduce nagging, NEVER to override student agency.
        """
        total = accepted_count + declined_count
        if total == 0:
            return 1.0, 1.0, False

        acceptance_rate = round(accepted_count / total, 2)

        # If student declines frequently (<35% acceptance with at least 3 decisions),
        # reduce low-priority nudge frequency by 50%
        reduce_nudges = total >= 3 and acceptance_rate < 0.35
        reduction_factor = 0.5 if reduce_nudges else 1.0

        return acceptance_rate, reduction_factor, reduce_nudges

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        intent = req.intent
        payload = req.payload

        if intent == "propose_adaptation":
            proposal_type = payload.get("proposal_type", "scaffold_change")
            proposal_payload = payload.get("proposal_payload", {})
            age_band = ctx.age_band or "11-15"
            disability = ctx.disability_types[0] if ctx.disability_types else None

            title, rationale, action = self.format_plain_language_prompt(
                proposal_type=proposal_type,
                proposal_payload=proposal_payload,
                age_band=age_band,
                disability_type=disability,
            )

            return AgentResponse(
                agent_name=self.name,
                status="success",
                data={
                    "plain_title": title,
                    "plain_rationale": rationale,
                    "proposed_action": action,
                    "proposal_type": proposal_type,
                    "proposal_payload": proposal_payload,
                },
                proposals=[],
            )

        elif intent == "record_consent":
            accepted_count = payload.get("accepted_count", 0)
            declined_count = payload.get("declined_count", 0)

            rate, factor, reduce_nudges = self.compute_trust_metrics(accepted_count, declined_count)

            return AgentResponse(
                agent_name=self.name,
                status="success",
                data={
                    "acceptance_rate": rate,
                    "nagging_reduction_factor": factor,
                    "reduce_nudges": reduce_nudges,
                },
                proposals=[],
            )

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={"status": "noop"},
            proposals=[],
        )


consent_trust_agent = ConsentTrustAgent()
registry.register(consent_trust_agent)
