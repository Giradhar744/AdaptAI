from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Text, Boolean, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.identity import Teacher
    from app.db.models.reference import AgeBand


class Course(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "courses"

    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(100), nullable=False)
    age_band_id: Mapped[str] = mapped_column(String(36), ForeignKey("age_bands.id"), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="courses")
    age_band: Mapped["AgeBand"] = relationship("AgeBand")
    chapters: Mapped[List["Chapter"]] = relationship("Chapter", back_populates="course", cascade="all, delete-orphan", order_by="Chapter.position")


class Chapter(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chapters"

    course_id: Mapped[str] = mapped_column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    course: Mapped["Course"] = relationship("Course", back_populates="chapters")
    lectures: Mapped[List["Lecture"]] = relationship("Lecture", back_populates="chapter", cascade="all, delete-orphan")


class Lecture(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lectures"

    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    video_ref: Mapped[str] = mapped_column(String(500), nullable=False)  # Provider-agnostic reference/URL
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="lectures")
