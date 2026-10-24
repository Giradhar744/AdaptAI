from typing import List, Optional
from sqlalchemy import String, Integer, Float, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin


class Diagnostic(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "diagnostics"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    age_at_test: Mapped[int] = mapped_column(Integer, nullable=False)
    disability_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("disability_types.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    recommended_course_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)

    student: Mapped["Student"] = relationship("Student")
    disability_type: Mapped["DisabilityType"] = relationship("DisabilityType")
    recommended_course: Mapped[Optional["Course"]] = relationship("Course")
    answers: Mapped[List["DiagnosticAnswer"]] = relationship("DiagnosticAnswer", back_populates="diagnostic", cascade="all, delete-orphan")


class DiagnosticAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "diagnostic_answers"

    diagnostic_id: Mapped[str] = mapped_column(String(36), ForeignKey("diagnostics.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    answer: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    diagnostic: Mapped["Diagnostic"] = relationship("Diagnostic", back_populates="answers")
    question: Mapped["Question"] = relationship("Question")
