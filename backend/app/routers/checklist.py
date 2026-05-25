from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.ownership import verify_ownership
from app.models.checklist import Checklist
from app.models.gacha import GachaDraw
from app.models.station import Station
from app.models.user import User
from app.schemas.checklist import ChecklistResponse, MissionToggleResponse
from app.schemas.stamp import StampCompleteResponse, StampResponse
from app.services.checklist_service import (
    complete_checklist,
    generate_checklist,
    get_checklist_by_draw,
    toggle_mission,
)
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/v1/checklists", tags=["checklists"])


async def _get_draw_with_ownership(
    draw_id: int, current_user: User, db: AsyncSession
) -> GachaDraw:
    result = await db.execute(select(GachaDraw).where(GachaDraw.id == draw_id))
    draw = result.scalar_one_or_none()
    if draw is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draw not found")
    await verify_ownership(draw.user_id, current_user.id)
    return draw


async def _get_checklist_with_ownership(
    checklist_id: int, current_user: User, db: AsyncSession
) -> Checklist:
    result = await db.execute(select(Checklist).where(Checklist.id == checklist_id))
    checklist = result.scalar_one_or_none()
    if checklist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")
    draw_result = await db.execute(select(GachaDraw).where(GachaDraw.id == checklist.draw_id))
    draw = draw_result.scalar_one()
    await verify_ownership(draw.user_id, current_user.id)
    return checklist


@router.get("/{draw_id}", response_model=ChecklistResponse)
async def get_checklist(
    draw_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    draw = await _get_draw_with_ownership(draw_id, current_user, db)
    checklist = await get_checklist_by_draw(db, draw.id)
    if checklist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist not yet generated",
        )

    station_result = await db.execute(select(Station).where(Station.id == draw.station_id))
    station = station_result.scalar_one()

    return ChecklistResponse(
        id=checklist.id,
        draw_id=checklist.draw_id,
        station_name=station.name,
        missions=checklist.missions,
        status=checklist.status,
        completed_at=checklist.completed_at,
    )


@router.post("/{draw_id}/generate", response_model=ChecklistResponse)
@limiter.limit("5/minute")
async def generate(
    request: Request,
    draw_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    draw = await _get_draw_with_ownership(draw_id, current_user, db)

    # TODO: SSE 스트리밍으로 교체 (AI친구 코드 연동 후)
    checklist = await generate_checklist(db, draw)

    station_result = await db.execute(select(Station).where(Station.id == draw.station_id))
    station = station_result.scalar_one()

    return ChecklistResponse(
        id=checklist.id,
        draw_id=checklist.draw_id,
        station_name=station.name,
        missions=checklist.missions,
        status=checklist.status,
        completed_at=checklist.completed_at,
    )


@router.patch("/{checklist_id}/missions/{seq}", response_model=MissionToggleResponse)
async def toggle_mission_endpoint(
    checklist_id: int,
    seq: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    checklist = await _get_checklist_with_ownership(checklist_id, current_user, db)
    result = await toggle_mission(db, checklist, seq)
    return result


@router.post("/{checklist_id}/complete", response_model=StampCompleteResponse)
async def complete(
    checklist_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    checklist = await _get_checklist_with_ownership(checklist_id, current_user, db)
    stamp = await complete_checklist(db, checklist, current_user.id)

    station_result = await db.execute(select(Station).where(Station.id == stamp.station_id))
    station = station_result.scalar_one()

    return StampCompleteResponse(
        stamp=StampResponse(
            id=stamp.id,
            station_id=stamp.station_id,
            station_name=station.name,
            line_name=station.line_name,
            train_type=station.train_type,
            rarity=stamp.rarity,
            acquired_at=stamp.acquired_at,
        )
    )
