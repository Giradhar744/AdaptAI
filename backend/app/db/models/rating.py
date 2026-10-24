from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin, utc_now


class CourseRating(Base, UUIDMixin, TimestampMixin):
    """Course star rating computed strictly from first-attempt chapter tests (PROJECT.md §6, §10.7).
    This table acts as a cache that is strictly recomputable from test_attempts where is_first_attempt = true.
    """
    __tablename__ = "course_ratings"

    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), unique=True, nullable=False)
    rating_value: Mapped[float] = mapped_column(Float, nullable=False)  # 1.0 to 5.0 stars
    computed_from_attempt_count: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    course: Mapped["Course"] = relationship("Course")
