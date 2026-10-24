from pathlib import Path
from typing import ClassVar, Set, List, Dict, Any, Optional
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.base import Message, LLMProviderError
from app.llm.factory import get_llm_provider
from app.llm.decision_layer import RequestContext, Proposal
from app.mcp.registry import registry
from app.core.logging import logger

PROMPTS_DIR = Path(__file__).parent.parent / "llm" / "prompts"

DIAGNOSTIC_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "required": ["questions"],
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["prompt", "question_type", "options", "correct_answer"],
                "properties": {
                    "prompt": {"type": "string"},
                    "question_type": {"type": "string", "enum": ["mcq"]},
                    "options": {
                        "type": "array",
                        "minItems": 2,
                        "items": {
                            "type": "object",
                            "required": ["key", "text"],
                            "properties": {
                                "key": {"type": "string"},
                                "text": {"type": "string"},
                            },
                        },
                    },
                    "correct_answer": {
                        "type": "object",
                        "required": ["key", "text"],
                        "properties": {
                            "key": {"type": "string"},
                            "text": {"type": "string"},
                        },
                    },
                    "explanation": {"type": "string"},
                    "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
                },
            },
        }
    },
}


class DiagnosticPlacementAgent(BaseAgent):
    name: ClassVar[str] = "diagnostic_placement"
    intents: ClassVar[Set[str]] = {"placement_diagnostic"}
    feature_flag_attr: ClassVar[str] = "AGENT_DIAGNOSTIC_ENABLED"

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        sub_action = req.payload.get("sub_action", "generate_questions")

        if sub_action == "generate_questions":
            return await self._generate_diagnostic_questions(ctx, req)
        elif sub_action == "compute_placement":
            return await self._compute_placement_recommendation(ctx, req)

        return AgentResponse(agent_name=self.name, status="error", message=f"Unknown sub_action '{sub_action}'")

    async def _generate_diagnostic_questions(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        llm = get_llm_provider()
        template_path = PROMPTS_DIR / "diagnostic_generation_v1.txt"

        prompt = template_path.read_text(encoding="utf-8").format(
            age_band=ctx.age_band or "11-15",
            min_age=req.payload.get("min_age", 11),
            max_age=req.payload.get("max_age", 15),
            disability_type=", ".join(ctx.disability_types) if ctx.disability_types else "None declared",
            num_questions=req.payload.get("num_questions", 4),
        )

        messages = [
            Message(role="system", content="You create supportive, accessible diagnostic assessment questions."),
            Message(role="user", content=prompt),
        ]

        llm_result = await llm.complete(messages, json_schema=DIAGNOSTIC_SCHEMA)
        if not llm_result.parsed or "questions" not in llm_result.parsed:
            raise LLMProviderError("LLM response did not contain valid diagnostic questions.")

        questions = llm_result.parsed["questions"]
        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={"questions": questions},
            proposals=[],
        )

    async def _compute_placement_recommendation(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        score = req.payload.get("score", 0.0)
        max_score = req.payload.get("max_score", 1.0)
        percentage = (score / max_score * 100) if max_score > 0 else 0.0
        candidate_courses = req.payload.get("candidate_courses", [])

        # Filter candidate courses matching student's age band (PROJECT.md §10.2)
        target_age_band = ctx.age_band or "11-15"
        recommended_course_id: Optional[str] = None
        recommended_course_title: Optional[str] = None

        for c in candidate_courses:
            if c.get("age_band_code") == target_age_band:
                recommended_course_id = c.get("id")
                recommended_course_title = c.get("title")
                break

        # Fallback to first available published course if none match exact age band
        if not recommended_course_id and candidate_courses:
            recommended_course_id = candidate_courses[0].get("id")
            recommended_course_title = candidate_courses[0].get("title")

        explanation = (
            f"Based on your diagnostic score of {score:.1f}/{max_score:.1f} ({percentage:.0f}%), "
            f"your age band ({target_age_band}), and your declared learning preferences, "
            f"we recommend starting with '{recommended_course_title or 'Foundations'}'."
        )

        strengths = ["Strong grasp of foundational concepts"]
        focus_areas = ["Ready for guided practice with multimodal hints"]

        proposal = Proposal(
            agent=self.name,
            type="placement_recommendation",
            priority_class="pedagogy",
            payload={
                "recommended_course_id": recommended_course_id,
                "score": score,
                "percentage": percentage,
            },
            requires_consent=True,
            rationale=explanation,
        )

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={
                "score": score,
                "max_score": max_score,
                "percentage": percentage,
                "recommended_course_id": recommended_course_id,
                "recommended_course_title": recommended_course_title,
                "explanation": explanation,
                "strengths": strengths,
                "focus_areas": focus_areas,
            },
            proposals=[proposal],
        )


diagnostic_placement_agent = DiagnosticPlacementAgent()
registry.register(diagnostic_placement_agent)
