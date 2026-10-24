from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TestQuestionOption(BaseModel):
    key: str
    text: str


class SafeTestQuestion(BaseModel):
    id: str
    prompt: str
    question_type: str
    options: List[TestQuestionOption]
    difficulty: Optional[str] = None


class TestAttemptStartResponse(BaseModel):
    attempt_id: str
    chapter_test_id: str
    student_id: str
    attempt_number: int
    is_first_attempt: bool
    time_limit_seconds: int
    started_at: str
    expires_at: str
    questions: List[SafeTestQuestion] = Field(default_factory=list)


class AttemptAnswerSubmit(BaseModel):
    question_id: str
    selected_key: str
    time_taken_ms: int = Field(default=0, ge=0)


class TestSubmitRequest(BaseModel):
    answers: List[AttemptAnswerSubmit] = Field(default_factory=list)


class AnswerFeedback(BaseModel):
    question_id: str
    selected_key: str
    correct_key: str
    is_correct: bool
    explanation: Optional[str] = None


class TestAttemptResultResponse(BaseModel):
    attempt_id: str
    chapter_test_id: str
    attempt_number: int
    is_first_attempt: bool
    score: float
    max_score: float
    score_percentage: float
    started_at: str
    submitted_at: str
    is_late: bool
    feedback: List[AnswerFeedback] = Field(default_factory=list)


class CourseRatingResponse(BaseModel):
    course_id: str
    rating_value: Optional[float] = None  # 1.0 to 5.0 stars
    computed_from_attempt_count: int
    min_required_attempts: int
    status: str  # published | insufficient_data
    computed_at: str


class StudentProgressItem(BaseModel):
    student_id: str
    student_name: str
    first_attempt_score: Optional[float] = None
    latest_attempt_score: Optional[float] = None
    attempts_count: int
    struggle_risk_level: Optional[str] = None


class CourseAnalyticsResponse(BaseModel):
    course_id: str
    course_title: str
    enrolled_students: int
    completed_first_attempts: int
    avg_first_attempt_score: float
    total_reattempts: int
    struggling_students_count: int
    rating: Optional[CourseRatingResponse] = None
    copilot_summary: str
    students_summary: List[StudentProgressItem] = Field(default_factory=list)
