import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.db.base import Base
from app.db.models import (
    DisabilityType,
    AgeBand,
    User,
    Teacher,
    Student,
    Course,
    Chapter,
    Lecture,
    ChapterTest,
    TestAttempt,
)
from app.db.seed_loader import load_seed_data


@pytest.fixture
async def test_db_session():
    """In-memory SQLite async database session for isolated testing."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_seed_loader_populates_reference_data(test_db_session: AsyncSession):
    """Verifies that seed YAML files correctly populate reference tables."""
    counts = await load_seed_data(test_db_session)
    assert counts["disability_types"] == 4
    assert counts["age_bands"] == 3

    # Verify disability types
    res = await test_db_session.execute(select(DisabilityType))
    dt_codes = [dt.code for dt in res.scalars().all()]
    assert set(dt_codes) == {"asd", "adhd", "dyslexia", "other_idd"}

    # Verify age bands
    res = await test_db_session.execute(select(AgeBand).where(AgeBand.code == "11-15"))
    ab_11_15 = res.scalar_one()
    assert ab_11_15.placement_max_age == 15

    res = await test_db_session.execute(select(AgeBand).where(AgeBand.code == "15-20"))
    ab_15_20 = res.scalar_one()
    assert ab_15_20.placement_min_age == 16


@pytest.mark.asyncio
async def test_identity_and_course_hierarchy(test_db_session: AsyncSession):
    """Verifies User, Teacher, Student, Course, Chapter, and Lecture models and relations."""
    await load_seed_data(test_db_session)

    # 1. Create Teacher
    user_teacher = User(email="teacher@example.com", password_hash="hashed_pw", role="teacher")
    test_db_session.add(user_teacher)
    await test_db_session.flush()

    teacher = Teacher(user_id=user_teacher.id, display_name="Prof. Sharma")
    test_db_session.add(teacher)
    await test_db_session.flush()

    # Get age band
    res = await test_db_session.execute(select(AgeBand).where(AgeBand.code == "11-15"))
    age_band = res.scalar_one()

    # 2. Create Course -> Chapter -> Lecture
    course = Course(
        teacher_id=teacher.id,
        title="Foundations of Science",
        subject="Science",
        age_band_id=age_band.id,
        description="Sensory-friendly science fundamentals.",
    )
    test_db_session.add(course)
    await test_db_session.flush()

    chapter = Chapter(course_id=course.id, title="Chapter 1: Matter and States", position=1)
    test_db_session.add(chapter)
    await test_db_session.flush()

    lecture = Lecture(
        chapter_id=chapter.id,
        title="States of Water",
        video_ref="https://www.youtube.com/watch?v=sample123",
        duration_seconds=300,
    )
    test_db_session.add(lecture)
    await test_db_session.commit()

    # Verify retrieval with selectinload for async relationships
    stmt = (
        select(Course)
        .where(Course.id == course.id)
        .options(selectinload(Course.chapters).selectinload(Chapter.lectures))
    )
    res = await test_db_session.execute(stmt)
    fetched_course = res.scalar_one()
    assert fetched_course.title == "Foundations of Science"
    assert len(fetched_course.chapters) == 1
    assert len(fetched_course.chapters[0].lectures) == 1
    assert fetched_course.chapters[0].lectures[0].title == "States of Water"


@pytest.mark.asyncio
async def test_first_attempt_rule(test_db_session: AsyncSession):
    """Verifies:
    - First attempt flag works
    - Reattempts are tracked separately
    """
    await load_seed_data(test_db_session)

    # Setup student and chapter test
    user = User(email="student@example.com", password_hash="pw", role="student")
    test_db_session.add(user)
    await test_db_session.flush()

    student = Student(user_id=user.id, display_name="Arjun", age=12)
    test_db_session.add(student)

    teacher_user = User(email="t2@example.com", password_hash="pw", role="teacher")
    test_db_session.add(teacher_user)
    await test_db_session.flush()

    teacher = Teacher(user_id=teacher_user.id, display_name="Teacher 2")
    test_db_session.add(teacher)
    await test_db_session.flush()

    res = await test_db_session.execute(select(AgeBand).where(AgeBand.code == "11-15"))
    ab = res.scalar_one()

    course = Course(teacher_id=teacher.id, title="Math", subject="Math", age_band_id=ab.id)
    test_db_session.add(course)
    await test_db_session.flush()

    chapter = Chapter(course_id=course.id, title="Ch 1", position=1)
    test_db_session.add(chapter)
    await test_db_session.flush()

    test = ChapterTest(chapter_id=chapter.id, time_limit_seconds=1200)
    test_db_session.add(test)
    await test_db_session.flush()

    # Attempt 1: First Attempt (REPORT: Used for teacher evaluation)
    attempt1 = TestAttempt(
        chapter_test_id=test.id,
        student_id=student.id,
        attempt_number=1,
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        score=8.0,
        max_score=10.0,
        is_first_attempt=True,
    )
    test_db_session.add(attempt1)

    # Attempt 2: Learning Reattempt (Excluded from rating)
    attempt2 = TestAttempt(
        chapter_test_id=test.id,
        student_id=student.id,
        attempt_number=2,
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
        score=10.0,
        max_score=10.0,
        is_first_attempt=False,
    )
    test_db_session.add(attempt2)
    await test_db_session.commit()

    # Verify query strictly for first attempts
    first_attempts = await test_db_session.execute(
        select(TestAttempt).where(
            TestAttempt.chapter_test_id == test.id,
            TestAttempt.is_first_attempt.is_(True),
        )
    )
    fa_list = first_attempts.scalars().all()
    assert len(fa_list) == 1
    assert fa_list[0].score == 8.0
