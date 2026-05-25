from pydantic import BaseModel


class StationResponse(BaseModel):
    id: int
    name: str
    line_name: str
    train_type: str
    requires_transfer: bool
    region_type: str
    weight: int

    model_config = {"from_attributes": True}
