from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin, utc_now


class Enrolment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrolments"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_student_course_enrolment"),
    )

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active | completed | dropped
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    student: Mapped["Student"] = relationship("Student")
    course: Mapped["Course"] = relationship("Course")


class ChapterProgress(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chapter_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "chapter_id", name="uq_student_chapter_progress"),
    )

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    lecture_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dpp_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    test_unlocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    student: Mapped["Student"] = relationship("Student")
    chapter: Mapped["Chapter"] = relationship("Chapter")
