import json
import time
from typing import List, Optional, Dict, Any
from jsonschema import validate, ValidationError

from app.core.logging import logger
from app.llm.base import LLMProvider, Message, LLMResult, LLMProviderError


class FakeLLMProvider:
    """Deterministic LLM Provider for offline development, CI/CD, and evaluation (PROJECT.md §7).
    Does not require network access or vendor API keys.
    """

    def __init__(self, failure_count: int = 0):
        self.call_count = 0
        self.failure_count = failure_count  # Simulates retries in tests

    async def complete(
        self,
        messages: List[Message],
        *,
        json_schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> LLMResult:
        start_time = time.perf_counter()
        self.call_count += 1

        if self.call_count <= self.failure_count:
            raise LLMProviderError(f"Simulated LLM transient failure on attempt {self.call_count}")

        # Extract last user message to determine intent/context
        last_user_content = ""
        for m in reversed(messages):
            if m.role == "user":
                last_user_content = m.content
                break

        # Generate deterministic response matching schema if requested
        if json_schema:
            data = self._generate_structured_fixture(last_user_content, json_schema)
            raw_text = json.dumps(data)
            try:
                validate(instance=data, schema=json_schema)
            except ValidationError as e:
                raise LLMProviderError(f"Generated fixture did not match schema: {e.message}") from e

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.debug(f"FakeLLM call #{self.call_count} completed in {elapsed_ms}ms")
            return LLMResult(
                text=raw_text,
                parsed=data,
                latency_ms=elapsed_ms,
                token_usage={"prompt_tokens": 50, "completion_tokens": 120, "total_tokens": 170},
            )

        # Free-text response
        response_text = self._generate_free_text(last_user_content)
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.debug(f"FakeLLM call #{self.call_count} completed in {elapsed_ms}ms")
        return LLMResult(
            text=response_text,
            parsed=None,
            latency_ms=elapsed_ms,
            token_usage={"prompt_tokens": 30, "completion_tokens": 40, "total_tokens": 70},
        )

    def _generate_structured_fixture(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Provides deterministic schema-compliant payloads for tests and agents."""
        lower = prompt.lower()

        # 1. DPP Questions Fixture
        if "dpp" in lower or "questions" in schema.get("properties", {}):
            return {
                "questions": [
                    {
                        "prompt": "What state of matter is steam?",
                        "question_type": "mcq",
                        "options": [
                            {"key": "A", "text": "Solid"},
                            {"key": "B", "text": "Liquid"},
                            {"key": "C", "text": "Gas"},
                            {"key": "D", "text": "Plasma"},
                        ],
                        "correct_answer": {"key": "C", "text": "Gas"},
                        "explanation": "Steam is water in its gaseous state formed when water boils.",
                        "difficulty": "easy",
                    },
                    {
                        "prompt": "Which process turns liquid water into ice?",
                        "question_type": "mcq",
                        "options": [
                            {"key": "A", "text": "Freezing"},
                            {"key": "B", "text": "Boiling"},
                            {"key": "C", "text": "Condensation"},
                            {"key": "D", "text": "Sublimation"},
                        ],
                        "correct_answer": {"key": "A", "text": "Freezing"},
                        "explanation": "Freezing occurs when thermal energy is removed, transforming liquid water into solid ice.",
                        "difficulty": "easy",
                    },
                ]
            }

        # 2. Diagnostic Recommendation Fixture
        if "recommended_course_id" in schema.get("properties", {}) or "placement" in lower:
            return {
                "recommended_course_id": "course-default-11-15",
                "score": 8.0,
                "explanation": "Based on foundational science assessment and age band, course 11-15 is recommended.",
                "strengths": ["Clear understanding of basic states of matter"],
                "focus_areas": ["Thermodynamics concepts"],
            }

        # 3. ZPD Hint Fixture
        if "hint_text" in schema.get("properties", {}) or "scaffold_level" in schema.get("properties", {}):
            return {
                "hint_text": "Remember that steam rises from a hot kettle because heat turns liquid into gas.",
                "scaffold_level": "partial_hint",
                "rationale": "Gives a familiar real-world cue without stating the multiple-choice option directly.",
            }

        # Generic fallback that populates required properties with reasonable types
        result: Dict[str, Any] = {}
        properties = schema.get("properties", {})
        for prop, details in properties.items():
            prop_type = details.get("type", "string")
            if prop_type == "string":
                result[prop] = f"Sample {prop}"
            elif prop_type == "integer":
                result[prop] = 1
            elif prop_type == "number":
                result[prop] = 1.0
            elif prop_type == "boolean":
                result[prop] = True
            elif prop_type == "array":
                result[prop] = []
            elif prop_type == "object":
                result[prop] = {}
        return result

    def _generate_free_text(self, prompt: str) -> str:
        return (
            "AdaptAI deterministic response: The learning material has been adapted according to the "
            "learner's cognitive preferences, pacing, and current scaffolding tier."
        )
