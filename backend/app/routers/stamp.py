from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.stamp import Stamp
from app.models.station import Station
from app.models.user import User
from app.schemas.stamp import LineStats, StampResponse, StampStatsResponse

router = APIRouter(prefix="/api/v1/stamps", tags=["stamps"])


@router.get("", response_model=list[StampResponse])
async def list_stamps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Stamp, Station)
        .join(Station, Stamp.station_id == Station.id)
        .where(Stamp.user_id == current_user.id)
        .order_by(Stamp.acquired_at.desc())
    )
    rows = result.all()
    return [
        StampResponse(
            id=stamp.id,
            station_id=stamp.station_id,
            station_name=station.name,
            line_name=station.line_name,
            train_type=station.train_type,
            rarity=stamp.rarity,
            acquired_at=stamp.acquired_at,
            illustration_url=station.illustration_url,
            illustration_credit=station.illustration_credit,
        )
        for stamp, station in rows
    ]


@router.get("/stats", response_model=StampStatsResponse)
async def stamp_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(
        select(Station.line_name, func.count(Station.id))
        .group_by(Station.line_name)
    )
    line_totals = {row[0]: row[1] for row in total_result.all()}

    collected_result = await db.execute(
        select(Station.line_name, func.count(Stamp.id))
        .join(Station, Stamp.station_id == Station.id)
        .where(Stamp.user_id == current_user.id)
        .group_by(Station.line_name)
    )
    line_collected = {row[0]: row[1] for row in collected_result.all()}

    total_stations = sum(line_totals.values())
    total_collected = sum(line_collected.values())

    lines = []
    for line_name, total in sorted(line_totals.items()):
        collected = line_collected.get(line_name, 0)
        pct = round(collected / total * 100, 1) if total > 0 else 0.0
        lines.append(LineStats(
            line_name=line_name,
            total=total,
            collected=collected,
            percentage=pct,
        ))

    return StampStatsResponse(
        total_stations=total_stations,
        collected=total_collected,
        lines=lines,
    )
