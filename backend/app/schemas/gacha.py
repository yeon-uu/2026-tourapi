from datetime import datetime

from pydantic import BaseModel


class GachaDrawResponse(BaseModel):
    draw_id: int
    station_id: int
    station_name: str
    line_name: str
    train_type: str
    requires_transfer: bool
    rarity: str
    remaining_draws: int

    model_config = {"from_attributes": True}


class GachaHistoryItem(BaseModel):
    id: int
    station_name: str
    line_name: str
    rarity: str
    created_at: datetime
