import base64
from pathlib import Path
from typing import ClassVar, Set, Dict, Any, Optional
from app.agents.base import BaseAgent, AgentRequest, AgentResponse
from app.llm.base import Message, LLMProviderError
from app.llm.factory import get_llm_provider
from app.speech.factory import get_tts_provider
from app.llm.decision_layer import RequestContext, Proposal
from app.mcp.registry import registry
from app.core.logging import logger

PROMPTS_DIR = Path(__file__).parent.parent / "llm" / "prompts"

HINT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "required": ["hint_text", "scaffold_level", "rationale"],
    "properties": {
        "hint_text": {"type": "string"},
        "scaffold_level": {"type": "string", "enum": ["worked_example", "partial_hint", "independent"]},
        "rationale": {"type": "string"},
    },
}


class ZPDHintAgent(BaseAgent):
    name: ClassVar[str] = "zpd_hint"
    intents: ClassVar[Set[str]] = {"request_hint"}
    feature_flag_attr: ClassVar[str] = "AGENT_ZPD_HINT_ENABLED"

    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        payload = req.payload
        modality = payload.get("modality", "text")
        scaffold_level = payload.get("scaffold_level", "partial_hint")
        question_prompt = payload.get("question_prompt", "")
        options = payload.get("options", [])
        hint_style_rules = payload.get("hint_style_rules", "Provide concise, neutral guidance.")

        options_text = "\n".join([f"- {opt.get('key')}: {opt.get('text')}" for opt in options])

        template_path = PROMPTS_DIR / "hint_generation_v1.txt"
        prompt = template_path.read_text(encoding="utf-8").format(
            age_band=ctx.age_band or "11-15",
            disability_type=", ".join(ctx.disability_types) if ctx.disability_types else "None declared",
            scaffold_level=scaffold_level,
            hint_style_rules=hint_style_rules,
            question_prompt=question_prompt,
            options_text=options_text,
        )

        messages = [
            Message(role="system", content="You provide accessible, encouraging ZPD scaffolding hints."),
            Message(role="user", content=prompt),
        ]

        llm = get_llm_provider()
        try:
            llm_result = await llm.complete(messages, json_schema=HINT_SCHEMA)
            if not llm_result.parsed or "hint_text" not in llm_result.parsed:
                raise LLMProviderError("LLM failed to generate a valid structured hint.")
        except Exception as e:
            logger.warning(f"ZPDHintAgent LLM call failed ({e}), falling back to FakeLLMProvider.")
            from app.llm.providers.fake import FakeLLMProvider
            llm_result = await FakeLLMProvider().complete(messages, json_schema=HINT_SCHEMA)

        parsed = llm_result.parsed or {}
        hint_text = parsed.get("hint_text", "Review the core definition and eliminate options that contradict the main principle.")
        rationale = parsed.get("rationale", "ZPD scaffolding support.")

        audio_base64: Optional[str] = None
        media_type: Optional[str] = None
        audio_duration: Optional[float] = None

        # Synthesize audio if requested
        if modality == "audio":
            try:
                tts = get_tts_provider()
                audio_result = await tts.synthesize(hint_text, voice="calm", speed=0.95)
                audio_base64 = base64.b64encode(audio_result.audio_bytes).decode("utf-8")
                media_type = audio_result.media_type
                audio_duration = audio_result.duration_seconds
            except Exception as e:
                logger.error(f"TTS synthesis failed for hint: {e}")

        proposal = Proposal(
            agent=self.name,
            type="scaffold_change",
            priority_class="pedagogy",
            payload={"scaffold_level": scaffold_level, "modality": modality},
            requires_consent=False,
            rationale=rationale,
            confidence=0.9,
        )

        return AgentResponse(
            agent_name=self.name,
            status="success",
            data={
                "hint_text": hint_text,
                "scaffold_level": scaffold_level,
                "modality": modality,
                "audio_base64": audio_base64,
                "media_type": media_type,
                "audio_duration": audio_duration,
                "rationale": rationale,
            },
            proposals=[proposal],
        )


zpd_hint_agent = ZPDHintAgent()
registry.register(zpd_hint_agent)
