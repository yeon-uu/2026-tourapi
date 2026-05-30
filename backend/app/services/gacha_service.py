import random
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gacha import GachaDraw
from app.models.stamp import Stamp
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


async def get_excluded_pairs(db: AsyncSession, user_id: int) -> set[tuple[int, str]]:
    """유저가 이미 보유한 (station_id, card_type) 조합 반환"""
    result = await db.execute(
        select(Stamp.station_id, Stamp.card_type).where(Stamp.user_id == user_id)
    )
    return set(result.all())


def determine_card_type(station: Station) -> str:
    """일러스트 있으면 special, 없으면 normal"""
    return "special" if station.illustration_url else "normal"


def determine_rarity(station: Station) -> str:
    """SSR = 시즌카드(일러스트), 나머지 전부 NORMAL"""
    if station.illustration_url:
        return "ssr"
    return "normal"


SPECIAL_WEIGHT_BOOST = 6  # 일러스트 역 가중치 배율 (스페셜카드 출현율 ↑)


def pick_station_weighted(stations: list[Station]) -> Station:
    weights = []
    for s in stations:
        w = s.weight
        if s.illustration_url:
            w *= SPECIAL_WEIGHT_BOOST
        weights.append(w)
    return random.choices(stations, weights=weights, k=1)[0]


async def draw_gacha(db: AsyncSession, user_id: int, departure_station_id: int) -> dict:
    today_count = await get_today_draw_count(db, user_id)
    if today_count >= MAX_DAILY_DRAWS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily draw limit reached ({MAX_DAILY_DRAWS}/day)",
        )

    # 유저가 보유한 (station_id, card_type) 조합
    excluded_pairs = await get_excluded_pairs(db, user_id)

    # 전체 역 가져오기
    result = await db.execute(select(Station))
    all_stations = list(result.scalars().all())

    # 출발역 제외 + 이미 같은 카드타입으로 스탬프 있는 역 제외
    available = []
    for s in all_stations:
        if s.id == departure_station_id:
            continue
        ct = determine_card_type(s)
        if (s.id, ct) not in excluded_pairs:
            available.append(s)

    if not available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All stations collected! No more draws available.",
        )

    station = pick_station_weighted(available)
    card_type = determine_card_type(station)
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
        "illustration_url": station.illustration_url,
        "illustration_credit": station.illustration_credit,
        "card_type": card_type,
    }
