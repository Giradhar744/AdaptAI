from typing import List, Set, Dict, Any, Tuple, Optional
from app.llm.decision_layer import Proposal
from app.core.logging import logger

# Priority Class Ranks (PROJECT.md §9.2: safety > consent > pedagogy > nudges)
PRIORITY_RANK = {
    "safety": 1,
    "consent": 2,
    "pedagogy": 3,
    "nudge": 4,
}


class PriorityEngine:
    """Reconciles agent outputs against the immutable priority hierarchy:
    safety > student consent > pedagogy > nudges (PROJECT.md §9).
    """

    @classmethod
    def resolve(
        cls,
        proposals: List[Proposal],
        declined_cooldown_types: Optional[Set[str]] = None,
    ) -> List[Proposal]:
        if not proposals:
            return []

        cooldowns = declined_cooldown_types or set()

        # 1. Filter out any proposal type currently in student/parent cooldown
        eligible: List[Proposal] = []
        for p in proposals:
            if p.type in cooldowns and p.priority_class != "safety":
                logger.info(f"Dropping proposal '{p.type}' due to active student consent cooldown.")
                continue
            eligible.append(p)

        if not eligible:
            return []

        # 2. Sort by Priority Class Rank (ascending), then Confidence (descending)
        def sort_key(p: Proposal) -> Tuple[int, float]:
            rank = PRIORITY_RANK.get(p.priority_class, 99)
            return (rank, -p.confidence)

        sorted_proposals = sorted(eligible, key=sort_key)

        # 3. Conflict Resolution: Keep the highest priority proposal for any given proposal type
        resolved: List[Proposal] = []
        seen_types: Set[str] = set()

        for p in sorted_proposals:
            if p.type not in seen_types:
                resolved.append(p)
                seen_types.add(p.type)
            else:
                logger.debug(
                    f"Conflict: Dropping conflicting lower-priority proposal of type '{p.type}' from agent '{p.agent}'."
                )

        return resolved
