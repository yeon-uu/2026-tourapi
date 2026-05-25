from datetime import datetime

from pydantic import BaseModel


class StampResponse(BaseModel):
    id: int
    station_id: int
    station_name: str
    line_name: str
    train_type: str
    rarity: str
    acquired_at: datetime

    model_config = {"from_attributes": True}


class StampCompleteResponse(BaseModel):
    stamp: StampResponse
    message: str = "Stamp acquired!"


class LineStats(BaseModel):
    line_name: str
    total: int
    collected: int
    percentage: float


class StampStatsResponse(BaseModel):
    total_stations: int
    collected: int
    lines: list[LineStats]
