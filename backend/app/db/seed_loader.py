import os
import yaml
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.db.models.reference import DisabilityType, AgeBand

SEED_DIR = Path(__file__).parent / "seed"


async def load_seed_data(session: AsyncSession) -> dict[str, int]:
    """Loads reference data from YAML seed files into the database.
    Idempotent: skips or updates records if they already exist.
    """
    counts = {
        "disability_types": 0,
        "age_bands": 0,
    }

    # 1. Disability Types
    disability_file = SEED_DIR / "disability_types.yaml"
    if disability_file.exists():
        with open(disability_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            for item in data.get("disability_types", []):
                result = await session.execute(
                    select(DisabilityType).where(DisabilityType.code == item["code"])
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    dt = DisabilityType(
                        code=item["code"],
                        label=item["label"],
                        description=item.get("description"),
                        hint_style_config=item.get("hint_style_config", {}),
                    )
                    session.add(dt)
                    counts["disability_types"] += 1
                else:
                    existing.label = item["label"]
                    existing.description = item.get("description")
                    existing.hint_style_config = item.get("hint_style_config", {})

    # 2. Age Bands
    age_bands_file = SEED_DIR / "age_bands.yaml"
    if age_bands_file.exists():
        with open(age_bands_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            for item in data.get("age_bands", []):
                result = await session.execute(
                    select(AgeBand).where(AgeBand.code == item["code"])
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    ab = AgeBand(
                        code=item["code"],
                        label=item["label"],
                        min_age=item["min_age"],
                        max_age=item["max_age"],
                        placement_min_age=item.get("placement_min_age", item["min_age"]),
                        placement_max_age=item.get("placement_max_age", item["max_age"]),
                    )
                    session.add(ab)
                    counts["age_bands"] += 1
                else:
                    existing.label = item["label"]
                    existing.min_age = item["min_age"]
                    existing.max_age = item["max_age"]
                    existing.placement_min_age = item.get("placement_min_age", item["min_age"])
                    existing.placement_max_age = item.get("placement_max_age", item["max_age"])

    await session.commit()
    logger.info(f"Loaded reference seed data: {counts}")
    return counts
