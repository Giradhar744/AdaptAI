from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

from app.core.config import settings


class RequestContext(BaseModel):
    """Context built by services before invoking AI decision layer (PROJECT.md §8)."""
    user_id: str
    role: str
    student_id: Optional[str] = None
    disability_types: List[str] = Field(default_factory=list)
    age_band: Optional[str] = None
    course_id: Optional[str] = None
    chapter_id: Optional[str] = None
    topic_id: Optional[str] = None
    recent_signals_summary: Dict[str, Any] = Field(default_factory=dict)
    stated_preferences: Dict[str, Any] = Field(default_factory=dict)


class Proposal(BaseModel):
    """Proposal emitted by an agent (PROJECT.md §9.1)."""
    agent: str
    type: str  # e.g. "scaffold_change", "break_suggestion", "modality_switch", "nudge"
    priority_class: Literal["safety", "consent", "pedagogy", "nudge"]
    payload: Dict[str, Any]
    requires_consent: bool = True
    rationale: str
    confidence: float = 1.0


class Constraint(BaseModel):
    type: str
    value: Any


class Decision(BaseModel):
    intent: str
    constraints: List[Constraint] = Field(default_factory=list)
    target_agents: List[str] = Field(default_factory=list)


# Action-to-Intent Fast Mapping (PROJECT.md §8.1)
# Eliminates unnecessary LLM calls and latency for predictable UI actions
ACTION_INTENT_MAP = {
    "placement_diagnostic": "placement_diagnostic",
    "generate_dpp": "generate_dpp",
    "generate_chapter_test": "generate_chapter_test",
    "request_hint": "request_hint",
    "assess_struggle": "assess_struggle",
    "propose_adaptation": "propose_adaptation",
    "record_consent": "record_consent",
    "teacher_analytics": "teacher_analytics",
    "compute_rating": "compute_rating",
}


class DecisionLayer:
    """LLM Decision Layer: Intent recognition and constraint-aware reasoning (PROJECT.md §8)."""

    @staticmethod
    def decide(
        ctx: RequestContext,
        action: Optional[str] = None,
        free_text: Optional[str] = None,
    ) -> Decision:
        # Fast path for known UI actions
        if action and action in ACTION_INTENT_MAP:
            intent = ACTION_INTENT_MAP[action]
            constraints: List[Constraint] = []

            # Add constraints from stored student preferences
            if ctx.stated_preferences:
                for k, v in ctx.stated_preferences.items():
                    constraints.append(Constraint(type=k, value=v))

            # Add disability modality constraints
            if "dyslexia" in ctx.disability_types:
                constraints.append(Constraint(type="hint_modality_recommendation", value="audio_or_short_text"))

            return Decision(
                intent=intent,
                constraints=constraints,
                target_agents=[],  # Router resolves agents from intent
            )

        # Fallback default intent if free_text provided
        return Decision(
            intent=action or "freeform_query",
            constraints=[],
            target_agents=[],
        )
