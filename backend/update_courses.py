import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import select, update
from app.db.models.content import Course

async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(update(Course).values(is_published=True))
        await session.commit()
        courses = (await session.execute(select(Course))).scalars().all()
        for c in courses:
            print(f"Course: {c.title}, is_published={c.is_published}")

asyncio.run(main())
