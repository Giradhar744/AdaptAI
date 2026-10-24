from abc import ABC, abstractmethod
from typing import ClassVar, Set, List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.llm.decision_layer import RequestContext, Proposal


class AgentRequest(BaseModel):
    intent: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    constraints: List[Dict[str, Any]] = Field(default_factory=list)


class AgentResponse(BaseModel):
    agent_name: str
    status: str = "success"  # success | error | disabled
    data: Dict[str, Any] = Field(default_factory=dict)
    proposals: List[Proposal] = Field(default_factory=list)
    message: Optional[str] = None


class BaseAgent(ABC):
    """Common contract for all six specialized AdaptAI agents (PROJECT.md §10.1).
    Rules:
    1. Agents are stateless.
    2. Agents return data and proposals; they NEVER write to the Consent Ledger
       or apply adaptations directly.
    3. Respects feature flag configuration.
    """
    name: ClassVar[str]
    intents: ClassVar[Set[str]]
    feature_flag_attr: ClassVar[str] = ""

    def is_enabled(self) -> bool:
        """Checks if the agent's feature flag is enabled in settings."""
        if not self.feature_flag_attr:
            return True
        from app.core.config import settings
        return getattr(settings, self.feature_flag_attr, True)

    @abstractmethod
    async def handle(self, ctx: RequestContext, req: AgentRequest) -> AgentResponse:
        """Processes request and returns structured data and zero or more proposals."""
        ...
