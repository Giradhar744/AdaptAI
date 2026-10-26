from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin


class DPP(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dpps"

    topic_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=True)
    lecture_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=True)
    generated_by: Mapped[str] = mapped_column(String(20), default="llm", nullable=False)  # llm | teacher
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False)  # draft | published

    topic: Mapped[Optional["Topic"]] = relationship("Topic")
    lecture: Mapped[Optional["Lecture"]] = relationship("Lecture")
    questions: Mapped[List["Question"]] = relationship(
        "Question",
        primaryjoin="and_(Question.parent_id == DPP.id, Question.parent_type == 'dpp')",
        foreign_keys="[Question.parent_id]",
        cascade="all, delete-orphan",
        overlaps="questions",
    )


class ChapterTest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chapter_tests"
    __test__ = False  # Avoid pytest trying to collect model as a test case

    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=1200, nullable=False)  # Default 20 mins
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False)

    chapter: Mapped["Chapter"] = relationship("Chapter")
    questions: Mapped[List["Question"]] = relationship(
        "Question",
        primaryjoin="and_(Question.parent_id == ChapterTest.id, Question.parent_type == 'chapter_test')",
        foreign_keys="[Question.parent_id]",
        cascade="all, delete-orphan",
        overlaps="questions",
    )


class Question(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questions"

    parent_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # dpp | chapter_test | diagnostic
    parent_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    prompt: Mapped[Text] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), default="mcq", nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)  # List of choices
    correct_answer: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"key": "A", "text": "..."}
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # easy | medium | hard


class TestAttempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "test_attempts"
    __test__ = False  # Avoid pytest collection collision

    chapter_test_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapter_tests.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_first_attempt: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    test: Mapped["ChapterTest"] = relationship("ChapterTest")
    student: Mapped["Student"] = relationship("Student")
    answers: Mapped[List["AttemptAnswer"]] = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class AttemptAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attempt_answers"

    attempt_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    answer: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    attempt: Mapped["TestAttempt"] = relationship("TestAttempt", back_populates="answers")
    question: Mapped["Question"] = relationship("Question")


class DPPSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dpp_sessions"

    dpp_id: Mapped[str] = mapped_column(String(36), ForeignKey("dpps.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    mode: Mapped[str] = mapped_column(String(20), default="independent", nullable=False)  # independent | ai_guided
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    dpp: Mapped["DPP"] = relationship("DPP")
    student: Mapped["Student"] = relationship("Student")
    responses: Mapped[List["DPPResponse"]] = relationship("DPPResponse", back_populates="session", cascade="all, delete-orphan")


class DPPResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dpp_responses"

    dpp_session_id: Mapped[str] = mapped_column(String(36), ForeignKey("dpp_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    answer: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hints_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    session: Mapped["DPPSession"] = relationship("DPPSession", back_populates="responses")
    question: Mapped["Question"] = relationship("Question")
