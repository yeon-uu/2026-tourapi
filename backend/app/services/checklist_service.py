import copy
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checklist import Checklist
from app.models.gacha import GachaDraw
from app.models.stamp import Stamp, get_current_season
from app.utils.sanitize import sanitize_missions

MOCK_MISSIONS = [
    {"seq": 1, "title": "역 앞 인증샷 찍기", "description": "역 간판이 보이게 사진을 찍어보세요", "completed": False},
    {"seq": 2, "title": "주변 맛집 탐방", "description": "역 근처 500m 이내 식당에서 식사해보세요", "completed": False},
    {"seq": 3, "title": "관광 명소 방문", "description": "주변 관광 명소를 하나 방문해보세요", "completed": False},
]


async def get_checklist_by_draw(db: AsyncSession, draw_id: int) -> Checklist | None:
    result = await db.execute(
        select(Checklist).where(Checklist.draw_id == draw_id)
    )
    return result.scalar_one_or_none()


async def generate_checklist(db: AsyncSession, draw: GachaDraw) -> Checklist:
    existing = await get_checklist_by_draw(db, draw.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Checklist already exists for this draw",
        )

    # TODO: AI친구 코드 연동 후 실제 LLM 생성으로 교체
    missions = sanitize_missions(MOCK_MISSIONS)

    checklist = Checklist(draw_id=draw.id, missions=missions)
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)
    return checklist


async def toggle_mission(db: AsyncSession, checklist: Checklist, seq: int) -> dict:
    missions = copy.deepcopy(checklist.missions)
    target = None
    for m in missions:
        if m["seq"] == seq:
            target = m
            break

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found"
        )

    target["completed"] = not target["completed"]
    checklist.missions = missions
    await db.commit()

    all_completed = all(m["completed"] for m in missions)
    return {"seq": seq, "completed": target["completed"], "all_completed": all_completed}


async def complete_checklist(db: AsyncSession, checklist: Checklist, user_id: int) -> Stamp:
    if checklist.status == "done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Checklist already completed",
        )

    missions = checklist.missions
    if not all(m["completed"] for m in missions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not all missions are completed",
        )

    draw_result = await db.execute(
        select(GachaDraw).where(GachaDraw.id == checklist.draw_id)
    )
    draw = draw_result.scalar_one()

    async with db.begin_nested():
        checklist.status = "done"
        checklist.completed_at = datetime.now(timezone.utc)

        stamp = Stamp(
            user_id=user_id,
            station_id=draw.station_id,
            checklist_id=checklist.id,
            rarity=draw.rarity,
            season=get_current_season(),
        )
        db.add(stamp)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stamp already exists for this station",
        )

    await db.refresh(stamp)
    return stamp
