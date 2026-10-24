from typing import Dict, List, Optional
from app.agents.base import BaseAgent
from app.core.logging import logger


class AgentRegistry:
    """Registry maintaining active agents exposed via MCP (PROJECT.md §4.1, §10.1)."""

    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}

    def register(self, agent: BaseAgent) -> None:
        self._agents[agent.name] = agent
        logger.debug(f"Registered agent '{agent.name}' for intents: {agent.intents}")

    def get_agent(self, name: str) -> Optional[BaseAgent]:
        return self._agents.get(name)

    def get_agents_for_intent(self, intent: str) -> List[BaseAgent]:
        return [
            agent for agent in self._agents.values()
            if intent in agent.intents and agent.is_enabled()
        ]

    def all_agents(self) -> List[BaseAgent]:
        return list(self._agents.values())


registry = AgentRegistry()
