import asyncio
from typing import List, Dict, Any
from app.agents.base import AgentRequest, AgentResponse
from app.llm.decision_layer import RequestContext, Decision, Proposal
from app.mcp.registry import registry
from app.core.logging import logger


class MCPRouter:
    """MCP Routing Layer: Dispatches intent to target agents and aggregates proposals (PROJECT.md §4.1)."""

    @staticmethod
    async def route(
        ctx: RequestContext,
        decision: Decision,
        payload: Dict[str, Any],
    ) -> List[AgentResponse]:
        agents = registry.get_agents_for_intent(decision.intent)
        if not agents:
            logger.info(f"No active agents found registered for intent '{decision.intent}'")
            return []

        req = AgentRequest(
            intent=decision.intent,
            payload=payload,
            constraints=[c.model_dump() for c in decision.constraints],
        )

        tasks = [agent.handle(ctx, req) for agent in agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        responses: List[AgentResponse] = []
        for agent, res in zip(agents, results):
            if isinstance(res, Exception):
                logger.error(f"Agent '{agent.name}' encountered error during handle(): {res}")
                responses.append(
                    AgentResponse(
                        agent_name=agent.name,
                        status="error",
                        message=str(res),
                    )
                )
            else:
                responses.append(res)

        return responses

    @staticmethod
    def extract_proposals(responses: List[AgentResponse]) -> List[Proposal]:
        """Extracts all proposals emitted across agent responses."""
        proposals: List[Proposal] = []
        for r in responses:
            if r.status == "success":
                proposals.extend(r.proposals)
        return proposals
