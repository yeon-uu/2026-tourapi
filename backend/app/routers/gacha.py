from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.gacha import GachaDraw
from app.models.station import Station
from app.models.user import User
from app.schemas.gacha import GachaDrawResponse, GachaHistoryItem
from app.services.gacha_service import draw_gacha
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/v1/gacha", tags=["gacha"])


@router.post("/draw", response_model=GachaDrawResponse)
@limiter.limit("10/minute")
async def gacha_draw(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await draw_gacha(db, current_user.id, current_user.departure_station_id)
    return result


@router.get("/history", response_model=list[GachaHistoryItem])
async def gacha_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GachaDraw, Station.name, Station.line_name)
        .join(Station, GachaDraw.station_id == Station.id)
        .where(GachaDraw.user_id == current_user.id)
        .order_by(GachaDraw.created_at.desc())
    )
    rows = result.all()
    return [
        GachaHistoryItem(
            id=draw.id,
            station_name=name,
            line_name=line_name,
            rarity=draw.rarity,
            created_at=draw.created_at,
        )
        for draw, name, line_name in rows
    ]
