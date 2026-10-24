from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models.reference import DisabilityType, AgeBand

router = APIRouter(prefix="/reference", tags=["Reference Data"])


class DisabilityTypeResponse(BaseModel):
    code: str
    label: str
    description: str | None
    hint_style_config: Dict[str, Any]


class AgeBandResponse(BaseModel):
    code: str
    label: str
    min_age: int
    max_age: int


@router.get("/disability-types", response_model=List[DisabilityTypeResponse])
async def get_disability_types(session: AsyncSession = Depends(get_db)):
    """Returns the list of supported disability types and default hint configurations."""
    res = await session.execute(select(DisabilityType).order_by(DisabilityType.code))
    records = res.scalars().all()
    return [
        DisabilityTypeResponse(
            code=r.code,
            label=r.label,
            description=r.description,
            hint_style_config=r.hint_style_config or {},
        )
        for r in records
    ]


@router.get("/age-bands", response_model=List[AgeBandResponse])
async def get_age_bands(session: AsyncSession = Depends(get_db)):
    """Returns the available age bands for course placement."""
    res = await session.execute(select(AgeBand).order_by(AgeBand.min_age))
    records = res.scalars().all()
    return [
        AgeBandResponse(
            code=r.code,
            label=r.label,
            min_age=r.min_age,
            max_age=r.max_age,
        )
        for r in records
    ]
