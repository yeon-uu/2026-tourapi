import random
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gacha import GachaDraw
from app.models.stamp import Stamp, get_current_season
from app.models.station import Station

MAX_DAILY_DRAWS = 50


async def get_today_draw_count(db: AsyncSession, user_id: int) -> int:
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    result = await db.execute(
        select(func.count(GachaDraw.id)).where(
            and_(
                GachaDraw.user_id == user_id,
                GachaDraw.created_at >= today_start,
            )
        )
    )
    return result.scalar_one()


async def get_excluded_station_ids(db: AsyncSession, user_id: int, departure_station_id: int) -> set[int]:
    current_season = get_current_season()
    result = await db.execute(
        select(Stamp.station_id).where(
            and_(Stamp.user_id == user_id, Stamp.season == current_season)
        )
    )
    stamped_ids = set(result.scalars().all())
    stamped_ids.add(departure_station_id)
    return stamped_ids


def pick_station_weighted(stations: list[Station]) -> Station:
    weights = [s.weight for s in stations]
    return random.choices(stations, weights=weights, k=1)[0]


def determine_rarity(station: Station) -> str:
    if station.train_type == "santa":
        return "ssr"
    if station.region_type == "depopulated":
        return "rare"
    return "normal"


async def draw_gacha(db: AsyncSession, user_id: int, departure_station_id: int) -> dict:
    today_count = await get_today_draw_count(db, user_id)
    if today_count >= MAX_DAILY_DRAWS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily draw limit reached ({MAX_DAILY_DRAWS}/day)",
        )

    excluded_ids = await get_excluded_station_ids(db, user_id, departure_station_id)

    result = await db.execute(
        select(Station).where(Station.id.notin_(excluded_ids))
    )
    available_stations = list(result.scalars().all())

    if not available_stations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All stations collected! No more draws available.",
        )

    station = pick_station_weighted(available_stations)
    rarity = determine_rarity(station)

    draw = GachaDraw(
        user_id=user_id,
        station_id=station.id,
        rarity=rarity,
    )
    db.add(draw)
    await db.commit()
    await db.refresh(draw)

    remaining = MAX_DAILY_DRAWS - today_count - 1

    return {
        "draw_id": draw.id,
        "station_id": station.id,
        "station_name": station.name,
        "line_name": station.line_name,
        "train_type": station.train_type,
        "requires_transfer": station.requires_transfer,
        "rarity": rarity,
        "remaining_draws": remaining,
    }
