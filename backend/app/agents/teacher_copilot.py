from typing import ClassVar, Set, Dict, Any, List, Optional
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.decision_layer import RequestContext
from app.mcp.registry import registry
from app.core.config import settings


class TeacherCopilotAgent(BaseAgent):
    name: ClassVar[str] = "teacher_copilot"
    intents: ClassVar[Set[str]] = {"teacher_analytics", "compute_rating"}
    feature_flag_attr: ClassVar[str] = "AGENT_TEACHER_COPILOT_ENABLED"

    @classmethod
    def calculate_course_stars(
        cls,
        first_attempt_ratios: List[float],
        min_attempts: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculates course star rating from students' first-attempt results (PROJECT.md §10.7 & §15.6).
        Formula: stars = 1 + 4 * mean_ratio (1.0 to 5.0 stars)
        Enforces min_attempts threshold before publishing.
        """
        threshold = min_attempts if min_attempts is not None else settings.RATING_MIN_ATTEMPTS
        count = len(first_attempt_ratios)

        if count < threshold:
            return {
                "status": "insufficient_data",
                "rating_value": None,
                "attempt_count": count,
                "min_required": threshold,
                "message": f"Requires at least {threshold} first attempts before publishing rating (current: {count}).",
            }

        mean_ratio = sum(first_attempt_ratios) / count if count > 0 else 0.0
        stars = round(min(5.0, max(1.0, 1.0 + 4.0 * mean_ratio)), 1)

        return {
            "status": "published",
            "rating_value": stars,
            "mean_ratio": round(mean_ratio, 3),
            "attempt_count": count,
            "min_required": threshold,
            "message": f"Course star rating is {stars} based on {count} first attempts.",
        }

    @classmethod
    def generate_narrative_summary(cls, metrics: Dict[str, Any]) -> str:
        """
        Generates teacher co-pilot narrative insight citing hard numbers per PROJECT.md §10.7.
        """
        enrolled = metrics.get("enrolled_students", 0)
        first_attempts = metrics.get("completed_first_attempts", 0)
        avg_score = metrics.get("avg_first_attempt_score", 0.0)
        reattempts = metrics.get("total_reattempts", 0)
        struggling = metrics.get("struggling_students_count", 0)

        if enrolled == 0:
            return "Course initialized. Awaiting student enrolments and onboarding diagnostic placements."

        parts = [
            f"Class engagement: {enrolled} students enrolled with {first_attempts} first-attempt chapter tests completed."
        ]

        if first_attempts > 0:
            parts.append(f"Average first-attempt test mastery stands at {avg_score:.1f}%.")

        if reattempts > 0:
            parts.append(
                f"Students demonstrated strong learning persistence with {reattempts} mastery re-attempts recorded."
            )

        if struggling > 0:
            parts.append(
                f"Attention: {struggling} student(s) triggered cognitive friction or struggle alerts. We recommend authoring a supplemental step-by-step worked example or short pause guidance."
            )
        else:
            parts.append("All enrolled students are progressing with steady pacing.")

        return " ".join(parts)

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        intent = req.intent
        payload = req.payload

        if intent == "compute_rating":
            ratios = payload.get("first_attempt_ratios", [])
            min_attempts = payload.get("min_attempts")
            rating_data = self.calculate_course_stars(ratios, min_attempts)
            return AgentResponse(
                agent_name=self.name,
                status="success",
                data=rating_data,
                proposals=[],
            )

        elif intent == "teacher_analytics":
            metrics = payload.get("metrics", {})
            summary = self.generate_narrative_summary(metrics)
            return AgentResponse(
                agent_name=self.name,
                status="success",
                data={"summary": summary, "metrics": metrics},
                proposals=[],
            )

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={"status": "noop"},
            proposals=[],
        )


teacher_copilot_agent = TeacherCopilotAgent()
registry.register(teacher_copilot_agent)
