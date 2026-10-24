from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class BehaviourSignalCreate(BaseModel):
    session_ref: str
    signal_type: Literal["response_latency", "error_pattern", "input_hesitation", "hint_request"]
    value: Dict[str, Any]


class BehaviourSignalResponse(BaseModel):
    id: str
    student_id: str
    session_ref: str
    signal_type: str
    value: Dict[str, Any]
    recorded_at: str


class TelemetryBatchRequest(BaseModel):
    signals: List[BehaviourSignalCreate] = Field(default_factory=list)


class StruggleAssessRequest(BaseModel):
    session_ref: str
    signals: Optional[List[BehaviourSignalCreate]] = None


class ProposalSummary(BaseModel):
    agent: str
    type: str
    priority_class: str
    payload: Dict[str, Any]
    requires_consent: bool
    rationale: str
    confidence: float


class StruggleAssessmentResponse(BaseModel):
    id: str
    student_id: str
    score: float
    risk_level: str
    features: Dict[str, Any]
    contributing_factors: List[str] = Field(default_factory=list)
    proposals: List[ProposalSummary] = Field(default_factory=list)
    model_version: str
    recorded_at: str
