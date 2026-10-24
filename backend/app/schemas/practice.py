from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.content_gen import QuestionSchema


class DPPSessionStartRequest(BaseModel):
    mode: Literal["independent", "ai_guided"] = "independent"


class DPPSessionResponse(BaseModel):
    session_id: str
    dpp_id: str
    student_id: str
    mode: str
    started_at: str
    questions: List[QuestionSchema] = Field(default_factory=list)


class HintRequest(BaseModel):
    question_id: str
    modality: Literal["text", "audio"] = "text"
    current_depth: Optional[str] = "partial_hint"


class HintResponse(BaseModel):
    hint_text: str
    scaffold_level: str
    modality: str
    audio_base64: Optional[str] = None
    media_type: Optional[str] = None
    audio_duration: Optional[float] = None
    rationale: str


class DPPResponseSubmitRequest(BaseModel):
    question_id: str
    answer: Dict[str, Any]  # e.g. {"selected_key": "C"}
    time_taken_ms: int = Field(default=0, ge=0)
    hints_used: int = Field(default=0, ge=0)


class DPPResponseResult(BaseModel):
    response_id: str
    question_id: str
    is_correct: bool
    explanation: Optional[str] = None
    correct_key: Optional[str] = None
    time_taken_ms: int


class DPPSessionSummary(BaseModel):
    session_id: str
    mode: str
    total_questions: int
    correct_count: int
    score_percentage: float
    total_time_ms: int
    total_hints_used: int
