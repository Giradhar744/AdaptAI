# Central export for all SQLAlchemy models

from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.models.reference import DisabilityType, AgeBand, ScaffoldLevel, PriorityOrder
from app.db.models.identity import User, Teacher, Student, DisabilityProfile
from app.db.models.content import Course, Chapter, Topic, Lecture
from app.db.models.practice import (
    DPP,
    Question,
    ChapterTest,
    TestAttempt,
    AttemptAnswer,
    DPPSession,
    DPPResponse,
)
from app.db.models.diagnostic import Diagnostic, DiagnosticAnswer
from app.db.models.progress import Enrolment, ChapterProgress
from app.db.models.adaptation import (
    HintEvent,
    BehaviourSignal,
    StruggleAssessment,
    ConsentLedger,
    StudentPreference,
    TrustProfile,
)
from app.db.models.rating import CourseRating

__all__ = [
    "Base",
    "UUIDMixin",
    "TimestampMixin",
    "DisabilityType",
    "AgeBand",
    "ScaffoldLevel",
    "PriorityOrder",
    "User",
    "Teacher",
    "Student",
    "DisabilityProfile",
    "Course",
    "Chapter",
    "Topic",
    "Lecture",
    "DPP",
    "Question",
    "ChapterTest",
    "TestAttempt",
    "AttemptAnswer",
    "DPPSession",
    "DPPResponse",
    "Diagnostic",
    "DiagnosticAnswer",
    "Enrolment",
    "ChapterProgress",
    "HintEvent",
    "BehaviourSignal",
    "StruggleAssessment",
    "ConsentLedger",
    "StudentPreference",
    "TrustProfile",
    "CourseRating",
]
