import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.db.models.identity import User, Teacher
from app.db.models.content import Course, Chapter, Topic, Lecture
from app.db.models.practice import DPP, Question
from app.db.models.reference import AgeBand
from sqlalchemy import select, update

COURSES_DATA = [
    {
        "age_band_code": "7-10",
        "title": "Foundations of Science: Nature & Living Things",
        "subject": "Science",
        "description": "A calm, visual introduction to plants, animals, ecosystems, and observing our natural world.",
        "fee": 0.0,
        "chapter_title": "Chapter 1: Plants and Living Things",
        "topic_title": "Plant Parts and Functions",
        "topic_content": "Green plants make food using sunlight, water, and air. Leaves are green due to chlorophyll.",
        "lecture_title": "Lesson 1: How Plants Grow",
        "dpp_title": "Plant Basics Practice",
        "questions": [
            {
                "prompt": "What do green plants need to make their food?",
                "options": [
                    {"key": "A", "text": "Sunlight, water, and air"},
                    {"key": "B", "text": "Sand, sugar, and milk"},
                    {"key": "C", "text": "Darkness and cold ice"},
                ],
                "correct_key": "A",
                "explanation": "Plants use sunlight, water, and carbon dioxide from the air to make nutrients through photosynthesis.",
            },
            {
                "prompt": "Which part of a plant absorbs water from the soil?",
                "options": [
                    {"key": "A", "text": "The flowers"},
                    {"key": "B", "text": "The roots"},
                    {"key": "C", "text": "The tree bark"},
                ],
                "correct_key": "B",
                "explanation": "Roots anchor the plant firmly into the soil and take in moisture and minerals.",
            },
        ],
    },
    {
        "age_band_code": "11-15",
        "title": "Foundations of Science: Matter, Energy & Systems",
        "subject": "Science",
        "description": "Understand solids, liquids, gases, energy transformations, and physical laws with simplified text and audio hints.",
        "fee": 0.0,
        "chapter_title": "Chapter 1: States of Matter",
        "topic_title": "Solids, Liquids, and Gases",
        "topic_content": "Matter exists in three primary states: solid, liquid, and gas. Solids keep their shape, while liquids take the shape of their container.",
        "lecture_title": "Lesson 1: Molecules in Motion",
        "dpp_title": "States of Matter Practice",
        "questions": [
            {
                "prompt": "What happens to the molecules of a liquid when heated into a gas?",
                "options": [
                    {"key": "A", "text": "They move faster and spread farther apart"},
                    {"key": "B", "text": "They slow down and lock into crystals"},
                    {"key": "C", "text": "They lose all mass and vanish"},
                ],
                "correct_key": "A",
                "explanation": "Adding heat energy increases molecular kinetic energy, causing particles to move rapidly apart as a gas.",
            },
            {
                "prompt": "Which state of matter takes both the shape and volume of its container?",
                "options": [
                    {"key": "A", "text": "A Solid"},
                    {"key": "B", "text": "A Liquid"},
                    {"key": "C", "text": "A Gas"},
                ],
                "correct_key": "C",
                "explanation": "Gases have neither fixed shape nor fixed volume and expand to fill any closed container.",
            },
        ],
    },
    {
        "age_band_code": "15-20",
        "title": "Foundations of Science: Physics & Chemistry Principles",
        "subject": "Science",
        "description": "Advanced physical science covering Newtonian mechanics, energy conservation, chemical bonds, and wave dynamics.",
        "fee": 0.0,
        "chapter_title": "Chapter 1: Newtonian Mechanics & Forces",
        "topic_title": "Newton's Laws of Motion",
        "topic_content": "Newton's First Law states an object at rest remains at rest unless acted upon by a net external force.",
        "lecture_title": "Lesson 1: Inertia and Acceleration",
        "dpp_title": "Newtonian Dynamics Practice",
        "questions": [
            {
                "prompt": "According to Newton's First Law, what causes a moving object to eventually stop if no friction is present?",
                "options": [
                    {"key": "A", "text": "Nothing—it continues moving at constant velocity indefinitely"},
                    {"key": "B", "text": "Its momentum automatically drains over time"},
                    {"key": "C", "text": "Gravity pulls it to a stop horizontally"},
                ],
                "correct_key": "A",
                "explanation": "In the absence of net external forces like friction or drag, an object in motion maintains its velocity indefinitely.",
            },
            {
                "prompt": "If force equals mass times acceleration (F = m * a), what happens to acceleration if mass doubles while force stays constant?",
                "options": [
                    {"key": "A", "text": "Acceleration doubles"},
                    {"key": "B", "text": "Acceleration is halved"},
                    {"key": "C", "text": "Acceleration stays identical"},
                ],
                "correct_key": "B",
                "explanation": "Since a = F / m, doubling mass cuts acceleration in half for the same applied force.",
            },
        ],
    },
]


async def seed_courses():
    async with AsyncSessionLocal() as session:
        # Find teacher
        teacher_res = await session.execute(select(Teacher))
        teacher = teacher_res.scalars().first()
        if not teacher:
            print("No teacher found. Run seed_users.py first.")
            return

        # Ensure all existing courses are published
        await session.execute(update(Course).values(is_published=True))
        await session.commit()

        for c_data in COURSES_DATA:
            band_res = await session.execute(select(AgeBand).where(AgeBand.code == c_data["age_band_code"]))
            band = band_res.scalar_one_or_none()
            if not band:
                print(f"Age band {c_data['age_band_code']} not found, skipping.")
                continue

            # Check if course exists for this age band with similar title
            existing = await session.execute(
                select(Course).where(Course.age_band_id == band.id, Course.title.ilike(f"%{c_data['title'][:20]}%"))
            )
            course = existing.scalars().first()

            if not course:
                course = Course(
                    teacher_id=teacher.id,
                    title=c_data["title"],
                    subject=c_data["subject"],
                    age_band_id=band.id,
                    description=c_data["description"],
                    fee=c_data["fee"],
                    is_published=True,
                )
                session.add(course)
                await session.flush()
                print(f"Created Course: {course.title} (AgeBand: {c_data['age_band_code']})")

                chapter = Chapter(
                    course_id=course.id,
                    title=c_data["chapter_title"],
                    position=1,
                )
                session.add(chapter)
                await session.flush()

                topic = Topic(
                    chapter_id=chapter.id,
                    title=c_data["topic_title"],
                    content_text=c_data["topic_content"],
                    position=1,
                )
                session.add(topic)
                await session.flush()

                # Lecture
                lecture = Lecture(
                    chapter_id=chapter.id,
                    title=c_data["lecture_title"],
                    video_ref="https://www.w3schools.com/html/mov_bbb.mp4",
                    duration_seconds=300,
                )
                session.add(lecture)
                await session.flush()

                # DPP
                dpp = DPP(
                    topic_id=topic.id,
                    lecture_id=lecture.id,
                    generated_by="teacher",
                    status="published",
                )
                session.add(dpp)
                await session.flush()

                # Questions
                for q_info in c_data["questions"]:
                    q = Question(
                        parent_type="dpp",
                        parent_id=dpp.id,
                        prompt=q_info["prompt"],
                        question_type="mcq",
                        options=q_info["options"],
                        correct_answer={"key": q_info["correct_key"]},
                        explanation=q_info["explanation"],
                        difficulty="easy",
                    )
                    session.add(q)

                await session.commit()
                print(f"  Added Chapter, Lecture, and DPP with {len(c_data['questions'])} questions.")
            else:
                course.is_published = True
                await session.commit()
                print(f"Course already exists: {course.title} (published=True)")


if __name__ == "__main__":
    asyncio.run(seed_courses())
