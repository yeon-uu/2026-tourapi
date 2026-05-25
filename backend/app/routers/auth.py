from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import create_access_token
from app.models.station import Station
from app.models.user import User
from app.schemas.auth import GuestLoginRequest, GuestLoginResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/guest", response_model=GuestLoginResponse)
async def guest_login(body: GuestLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Station).where(Station.id == body.departure_station_id))
    station = result.scalar_one_or_none()
    if station is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid departure station",
        )

    user = User(nickname=body.nickname, departure_station_id=body.departure_station_id)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return GuestLoginResponse(
        access_token=token,
        user_id=user.id,
        nickname=user.nickname,
    )
