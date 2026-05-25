from datetime import datetime

from pydantic import BaseModel


class MissionItem(BaseModel):
    seq: int
    title: str
    description: str
    completed: bool = False


class ChecklistResponse(BaseModel):
    id: int
    draw_id: int
    station_name: str
    missions: list[MissionItem]
    status: str
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class MissionToggleResponse(BaseModel):
    seq: int
    completed: bool
    all_completed: bool
