import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.db.seed_loader import load_seed_data
import app.db.models  # Ensure all models are imported


async def run_seed():
    print("Creating tables if they do not exist...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    print("Loading reference seed data...")
    async with AsyncSessionLocal() as session:
        counts = await load_seed_data(session)
        print(f"Seed loading complete: {counts}")


if __name__ == "__main__":
    asyncio.run(run_seed())
