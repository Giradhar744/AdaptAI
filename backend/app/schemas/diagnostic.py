from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.content_gen import QuestionSchema


class AnswerSubmission(BaseModel):
    question_id: str
    selected_key: str = Field(description="Selected option key: A, B, C, or D")
    time_taken_ms: int = Field(default=0, ge=0)


class DiagnosticStartResponse(BaseModel):
    diagnostic_id: str
    student_id: str
    age: int
    age_band_label: str
    questions: List[QuestionSchema]


class DiagnosticSubmitRequest(BaseModel):
    answers: List[AnswerSubmission]


class DiagnosticResultResponse(BaseModel):
    diagnostic_id: str
    student_id: str
    score: float
    max_score: float
    percentage: float
    recommended_age_band: str = "11-15"
    progression_age_band: Optional[str] = None
    recommended_course_id: Optional[str] = None
    recommended_course_title: Optional[str] = None
    recommended_courses: List[dict] = Field(default_factory=list)
    progression_courses: List[dict] = Field(default_factory=list)
    explanation: str
    strengths: List[str] = Field(default_factory=list)
    focus_areas: List[str] = Field(default_factory=list)


class EnrolmentResponse(BaseModel):
    enrolment_id: str
    student_id: str
    course_id: str
    course_title: str
    status: str
    enrolled_at: str
