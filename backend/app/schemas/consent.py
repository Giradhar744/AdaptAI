from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class ConsentDecisionRequest(BaseModel):
    decision: Literal["approved", "declined"]
    decided_by: Literal["student", "parent"] = "student"


class ConsentLedgerItem(BaseModel):
    id: str
    student_id: str
    proposal_type: str
    proposal_payload: Dict[str, Any]
    proposed_by_agent: str
    priority_class: str
    status: str  # pending | approved | declined | auto_applied | expired
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    supersedes_id: Optional[str] = None
    created_at: str


class PendingProposalResponse(BaseModel):
    ledger_id: str
    student_id: str
    proposal_type: str
    proposed_by_agent: str
    priority_class: str
    plain_title: str
    plain_rationale: str
    proposed_action: str
    proposal_payload: Dict[str, Any]
    created_at: str


class TrustProfileResponse(BaseModel):
    student_id: str
    accepted_count: int
    declined_count: int
    total_decisions: int
    acceptance_rate: float
    nagging_reduction_factor: float
    last_updated: str


class StudentPreferenceResponse(BaseModel):
    key: str
    value: Dict[str, Any]
    updated_at: str


class RevokePreferenceRequest(BaseModel):
    preference_key: str
    decided_by: Literal["student", "parent"] = "student"


class CreateProposalRequest(BaseModel):
    proposal_type: str = "scaffold_change"
    payload: Dict[str, Any] = Field(default_factory=lambda: {"scaffold_level": "worked_example"})
    proposed_by_agent: str = "struggle_detection"
    priority_class: str = "pedagogy"
    rationale: Optional[str] = "Student experienced friction with multi-step reasoning."

