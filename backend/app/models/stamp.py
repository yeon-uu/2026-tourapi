from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Stamp(Base):
    __tablename__ = "stamps"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "station_id", "card_type",
            name="uq_stamp_user_station_cardtype",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id"), nullable=False
    )
    checklist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("checklists.id"), nullable=False
    )
    rarity: Mapped[str] = mapped_column(String(10), nullable=False)
    card_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="normal"
    )  # "normal" | "special"
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
