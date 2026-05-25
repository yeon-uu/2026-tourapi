from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    line_name: Mapped[str] = mapped_column(String(50), nullable=False)
    train_type: Mapped[str] = mapped_column(String(10), nullable=False)  # ktx / santa
    requires_transfer: Mapped[bool] = mapped_column(Boolean, default=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    region_type: Mapped[str] = mapped_column(String(20), nullable=False)  # normal / depopulated
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    stamp_image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
