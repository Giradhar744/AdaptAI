from sqlalchemy import String, Integer, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDMixin, TimestampMixin


class DisabilityType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "disability_types"

    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    hint_style_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgeBand(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "age_bands"

    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    min_age: Mapped[int] = mapped_column(Integer, nullable=False)
    max_age: Mapped[int] = mapped_column(Integer, nullable=False)
    placement_min_age: Mapped[int] = mapped_column(Integer, nullable=False)
    placement_max_age: Mapped[int] = mapped_column(Integer, nullable=False)


class ScaffoldLevel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scaffold_levels"

    ordinal: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    reveals_target_answer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PriorityOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "priority_orders"

    rank: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    class_name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)
    requires_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    can_override_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
