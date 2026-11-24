import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.services.auth_service import AuthService
from app.schemas.auth import UserRegisterRequest
from sqlalchemy import select
from app.db.models.identity import User


async def create_demo_users():
    # 1. Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Check and seed demo users
    async with AsyncSessionLocal() as session:
        # Teacher
        existing_teacher = await session.execute(
            select(User).where(User.email == "teacher@adaptai.edu")
        )
        if not existing_teacher.scalar_one_or_none():
            t_req = UserRegisterRequest(
                email="teacher@adaptai.edu",
                password="password123",
                role="teacher",
                display_name="Dr. Sarah Rao",
            )
            await AuthService.register(session, t_req)
            print("Created teacher account: teacher@adaptai.edu / password123")
        else:
            print("Teacher account already exists.")

        # Student
        existing_student = await session.execute(
            select(User).where(User.email == "student@adaptai.edu")
        )
        if not existing_student.scalar_one_or_none():
            s_req = UserRegisterRequest(
                email="student@adaptai.edu",
                password="password123",
                role="student",
                display_name="Alex Johnson",
                age=14,
                disability_type_code="adhd",
            )
            await AuthService.register(session, s_req)
            print("Created student account: student@adaptai.edu / password123")
        else:
            print("Student account already exists.")


if __name__ == "__main__":
    asyncio.run(create_demo_users())
