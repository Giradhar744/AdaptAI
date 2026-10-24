from typing import Optional, List
from sqlalchemy import String, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # teacher | student | parent
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    teacher_profile: Mapped[Optional["Teacher"]] = relationship("Teacher", back_populates="user", uselist=False)
    student_profile: Mapped[Optional["Student"]] = relationship("Student", foreign_keys="Student.user_id", back_populates="user", uselist=False)


class Teacher(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teachers"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="teacher_profile")
    courses: Mapped[List["Course"]] = relationship("Course", back_populates="teacher")


class Student(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "students"

    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    parent_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    age_band_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("age_bands.id"), nullable=True)

    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id], back_populates="student_profile")
    parent_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[parent_user_id])
    age_band: Mapped[Optional["AgeBand"]] = relationship("AgeBand")

    disabilities: Mapped[List["DisabilityProfile"]] = relationship("DisabilityProfile", back_populates="student", cascade="all, delete-orphan")


class DisabilityProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "disability_profiles"

    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    disability_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("disability_types.id", ondelete="RESTRICT"), nullable=False)

    student: Mapped["Student"] = relationship("Student", back_populates="disabilities")
    disability_type: Mapped["DisabilityType"] = relationship("DisabilityType")
