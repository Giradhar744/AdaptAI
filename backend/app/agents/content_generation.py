from pathlib import Path
from typing import ClassVar, Set, List, Dict, Any
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.base import Message, LLMProviderError
from app.llm.factory import get_llm_provider
from app.llm.decision_layer import RequestContext
from app.mcp.registry import registry
from app.core.config import settings
from app.core.logging import logger

PROMPTS_DIR = Path(__file__).parent.parent / "llm" / "prompts"

QUESTION_SCHEMA: Dict[str, Any] = {
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
                        "minItems": 4,
                        "maxItems": 4,
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


class ContentGenerationAgent(BaseAgent):
    name: ClassVar[str] = "content_generation"
    intents: ClassVar[Set[str]] = {"generate_dpp", "generate_chapter_test"}
    feature_flag_attr: ClassVar[str] = "AGENT_CONTENT_GEN_ENABLED"

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        llm = get_llm_provider()
        payload = req.payload

        if req.intent == "generate_dpp":
            template_path = PROMPTS_DIR / "dpp_generation_v1.txt"
            num_questions = payload.get("num_questions", settings.DPP_DEFAULT_QUESTIONS)
            prompt = template_path.read_text(encoding="utf-8").format(
                age_band=ctx.age_band or "11-15",
                subject=payload.get("subject", "General Subject"),
                topic_title=payload.get("topic_title", "General Topic"),
                content_text=payload.get("content_text", ""),
                num_questions=num_questions,
            )
        else:  # generate_chapter_test
            template_path = PROMPTS_DIR / "chapter_test_generation_v1.txt"
            num_questions = payload.get("num_questions", settings.TEST_DEFAULT_QUESTIONS)
            prompt = template_path.read_text(encoding="utf-8").format(
                age_band=ctx.age_band or "11-15",
                subject=payload.get("subject", "General Subject"),
                chapter_title=payload.get("chapter_title", "General Chapter"),
                content_text=payload.get("content_text", ""),
                num_questions=num_questions,
            )

        messages = [
            Message(role="system", content="You generate accessible, high-clarity multiple choice questions."),
            Message(role="user", content=prompt),
        ]

        llm_result = await llm.complete(messages, json_schema=QUESTION_SCHEMA)
        if not llm_result.parsed or "questions" not in llm_result.parsed:
            raise LLMProviderError("LLM response did not contain valid structured questions.")

        raw_questions = llm_result.parsed["questions"]
        validated_questions = self._validate_and_sanitize_questions(raw_questions)

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={
                "intent": req.intent,
                "questions_count": len(validated_questions),
                "questions": validated_questions,
            },
            proposals=[],
        )

    def _validate_and_sanitize_questions(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enforces PROJECT.md §10.4 requirements:
        - Each question has correct answer present in options
        - No duplicate prompts
        """
        seen_prompts: Set[str] = set()
        sanitized: List[Dict[str, Any]] = []

        for q in questions:
            prompt = q.get("prompt", "").strip()
            if not prompt or prompt in seen_prompts:
                continue  # Skip duplicate prompt

            options = q.get("options", [])
            keys = ["A", "B", "C", "D"]
            cleaned_options = []
            for i, opt in enumerate(options[:4]):
                k = keys[i]
                t = opt.get("text", f"Option {k}")
                cleaned_options.append({"key": k, "text": t})

            while len(cleaned_options) < 4:
                idx = len(cleaned_options)
                cleaned_options.append({"key": keys[idx], "text": f"Alternative option {keys[idx]}"})

            q["options"] = cleaned_options

            correct = q.get("correct_answer", {})
            correct_key = correct.get("key")
            option_keys = {opt["key"] for opt in cleaned_options}
            if correct_key not in option_keys:
                logger.warning(f"Question prompt '{prompt[:30]}...' correct key '{correct_key}' missing from options; fixing.")
                q["correct_answer"] = {"key": cleaned_options[0]["key"], "text": cleaned_options[0]["text"]}
            else:
                matching_opt = next((o for o in cleaned_options if o["key"] == correct_key), cleaned_options[0])
                q["correct_answer"] = {"key": matching_opt["key"], "text": matching_opt["text"]}

            seen_prompts.add(prompt)
            sanitized.append(q)

        return sanitized


content_generation_agent = ContentGenerationAgent()
registry.register(content_generation_agent)
