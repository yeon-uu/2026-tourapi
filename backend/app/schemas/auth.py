from pydantic import BaseModel, Field


class GuestLoginRequest(BaseModel):
    nickname: str = Field(..., min_length=2, max_length=10)
    departure_station_id: int


class GuestLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    nickname: str
