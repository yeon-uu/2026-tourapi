from pydantic import BaseModel


class StationResponse(BaseModel):
    id: int
    name: str
    line_name: str
    train_type: str
    requires_transfer: bool
    region_type: str
    weight: int
    description: str | None = None
    illustration_url: str | None = None
    illustration_credit: str | None = None

    model_config = {"from_attributes": True}
