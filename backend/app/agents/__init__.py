# Automatically imports and registers all six agents into MCP registry

from app.agents.diagnostic_placement import diagnostic_placement_agent
from app.agents.zpd_hint import zpd_hint_agent
from app.agents.content_generation import content_generation_agent
from app.agents.struggle_detection import struggle_detection_agent
from app.agents.consent_trust import consent_trust_agent
from app.agents.teacher_copilot import teacher_copilot_agent

__all__ = [
    "diagnostic_placement_agent",
    "zpd_hint_agent",
    "content_generation_agent",
    "struggle_detection_agent",
    "consent_trust_agent",
    "teacher_copilot_agent",
]
