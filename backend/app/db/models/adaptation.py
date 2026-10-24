from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin, utc_now


class HintEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hint_events"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    scaffold_level: Mapped[str] = mapped_column(String(50), nullable=False)  # worked_example | partial_hint | independent
    modality: Mapped[str] = mapped_column(String(20), default="text", nullable=False)  # text | audio
    disability_type_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("disability_types.id"), nullable=True)

    student: Mapped["Student"] = relationship("Student")
    question: Mapped["Question"] = relationship("Question")
    disability_type: Mapped[Optional["DisabilityType"]] = relationship("DisabilityType")


class BehaviourSignal(Base, UUIDMixin, TimestampMixin):
    """Captures the four specific behavioural signals defined in PROJECT.md §6 & §10.5:
    response_latency, error_pattern, input_hesitation, hint_request.
    """
    __tablename__ = "behaviour_signals"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    session_ref: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    signal_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # response_latency | error_pattern | input_hesitation | hint_request
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    student: Mapped["Student"] = relationship("Student")


class StruggleAssessment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "struggle_assessments"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 to 1.0
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)  # low | medium | high
    features: Mapped[dict] = mapped_column(JSON, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), default="v1.0-rules", nullable=False)

    student: Mapped["Student"] = relationship("Student")


class ConsentLedger(Base, UUIDMixin, TimestampMixin):
    """Append-only ledger of proposed adaptations and decisions (PROJECT.md §6, §9).
    No UPDATE or DELETE is ever executed on this table. A subsequent decision creates
    a new row referencing supersedes_id.
    """
    __tablename__ = "consent_ledger"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    proposal_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    proposal_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    proposed_by_agent: Mapped[str] = mapped_column(String(50), nullable=False)
    priority_class: Mapped[str] = mapped_column(String(20), nullable=False)  # safety | consent | pedagogy | nudge
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)  # pending | approved | declined | auto_applied | expired
    decided_by: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # student | parent | system
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    supersedes_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("consent_ledger.id"), nullable=True)

    student: Mapped["Student"] = relationship("Student")


class StudentPreference(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_preferences"
    __table_args__ = (
        UniqueConstraint("student_id", "key", name="uq_student_pref_key"),
    )

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)

    student: Mapped["Student"] = relationship("Student")


class TrustProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trust_profiles"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    declined_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    student: Mapped["Student"] = relationship("Student")
