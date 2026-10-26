from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class QuestionOption(BaseModel):
    key: str = Field(description="Option letter, e.g., A, B, C, D")
    text: str = Field(description="Option text")


class CorrectAnswer(BaseModel):
    key: str = Field(description="Key of correct option, e.g., A")
    text: str = Field(description="Text of correct option")


class QuestionSchema(BaseModel):
    id: Optional[str] = None
    prompt: str = Field(min_length=5)
    question_type: str = "mcq"
    options: List[QuestionOption]
    correct_answer: CorrectAnswer
    explanation: Optional[str] = None
    difficulty: Optional[str] = "medium"


class DPPResponse(BaseModel):
    id: str
    topic_id: Optional[str] = None
    lecture_id: Optional[str] = None
    generated_by: str
    status: str
    questions_count: int
    questions: List[QuestionSchema] = Field(default_factory=list)


class ChapterTestResponse(BaseModel):
    id: str
    chapter_id: str
    time_limit_seconds: int
    status: str
    questions_count: int
    questions: List[QuestionSchema] = Field(default_factory=list)


class StatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(draft|published)$")


class QuestionUpdateRequest(BaseModel):
    prompt: Optional[str] = Field(default=None, min_length=5)
    options: Optional[List[QuestionOption]] = None
    correct_answer: Optional[CorrectAnswer] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None


class QuestionCreateRequest(BaseModel):
    prompt: str = Field(min_length=5)
    options: List[QuestionOption]
    correct_answer: CorrectAnswer
    explanation: Optional[str] = None
    difficulty: Optional[str] = "medium"
