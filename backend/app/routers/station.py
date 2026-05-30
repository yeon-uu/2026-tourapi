from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.station import Station
from app.schemas.station import StationResponse
from app.seed_data import ROUTES

router = APIRouter(prefix="/api/v1/stations", tags=["stations"])


@router.get("", response_model=list[StationResponse])
async def list_stations(db: AsyncSession = Depends(get_db)):
    """역 목록 (ㄱㄴㄷ순)"""
    result = await db.execute(select(Station).order_by(Station.name))
    stations = result.scalars().all()
    return stations


@router.get("/routes")
async def get_routes():
    """노선별 역 그룹 (컬렉션 페이지용)"""
    return ROUTES
