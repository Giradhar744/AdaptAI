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

        try:
            llm_result = await llm.complete(messages, json_schema=DIAGNOSTIC_SCHEMA)
            if not llm_result.parsed or "questions" not in llm_result.parsed:
                raise LLMProviderError("LLM response did not contain valid diagnostic questions.")
        except Exception as e:
            logger.warning(f"DiagnosticPlacementAgent LLM failed ({e}). Falling back to FakeLLMProvider.")
            from app.llm.providers.fake import FakeLLMProvider
            llm_result = await FakeLLMProvider().complete(messages, json_schema=DIAGNOSTIC_SCHEMA)

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

        # Map score percentage to required age bands (PROJECT.md & Product Specification §7.1, §8.1)
        if percentage < 50.0:
            target_age_band = "7-10"
            target_label = "Below 11 years"
            progression_age_band = "11-15"
            progression_label = "11–15 years"
        elif percentage <= 75.0:
            target_age_band = "11-15"
            target_label = "11–15 years"
            progression_age_band = "15-20"
            progression_label = "Above 15 years"
        else:
            target_age_band = "15-20"
            target_label = "Above 15 years"
            progression_age_band = None
            progression_label = None

        recommended_courses = [c for c in candidate_courses if c.get("age_band_code") == target_age_band]
        progression_courses = [c for c in candidate_courses if c.get("age_band_code") == progression_age_band] if progression_age_band else []

        recommended_course_id: Optional[str] = recommended_courses[0].get("id") if recommended_courses else None
        recommended_course_title: Optional[str] = recommended_courses[0].get("title") if recommended_courses else None

        # Fallback to first available published course if none match exact recommended age band
        if not recommended_course_id and candidate_courses:
            recommended_course_id = candidate_courses[0].get("id")
            recommended_course_title = candidate_courses[0].get("title")

        explanation = (
            f"Based on your placement assessment score of {score:.1f}/{max_score:.1f} ({percentage:.0f}%), "
            f"your recommended starting level is {target_label} ({target_age_band}). "
            + (f"Suggested next progression level: {progression_label} ({progression_age_band})." if progression_age_band else "You placed into the highest course level.")
        )

        strengths = [
            f"Demonstrated foundational competence at {percentage:.0f}% accuracy",
            "Clear readiness for structured multi-modal practice",
        ]
        focus_areas = [
            f"Focus on core concepts in {target_label} curricula",
            "Utilize audio and text hints when approaching unfamiliar topics",
        ]

        proposal = Proposal(
            agent=self.name,
            type="placement_recommendation",
            priority_class="pedagogy",
            payload={
                "recommended_course_id": recommended_course_id,
                "recommended_age_band": target_age_band,
                "progression_age_band": progression_age_band,
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
                "recommended_age_band": target_age_band,
                "progression_age_band": progression_age_band,
                "recommended_course_id": recommended_course_id,
                "recommended_course_title": recommended_course_title,
                "recommended_courses": recommended_courses,
                "progression_courses": progression_courses,
                "explanation": explanation,
                "strengths": strengths,
                "focus_areas": focus_areas,
            },
            proposals=[proposal],
        )


diagnostic_placement_agent = DiagnosticPlacementAgent()
registry.register(diagnostic_placement_agent)
