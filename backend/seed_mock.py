import asyncio

from sqlalchemy import select

from app.database import async_session
from app.models.station import Station


async def seed():
    async with async_session() as db:
        result = await db.execute(select(Station))
        if result.scalars().first():
            print("Stations already seeded")
            return

        mock_stations = [
            Station(name="서울", line_name="경부선", train_type="ktx", requires_transfer=False, lat=37.5547, lng=126.9707, region_type="normal", weight=1),
            Station(name="대전", line_name="경부선", train_type="ktx", requires_transfer=False, lat=36.3322, lng=127.4346, region_type="normal", weight=1),
            Station(name="동대구", line_name="경부선", train_type="ktx", requires_transfer=False, lat=35.8797, lng=128.6286, region_type="normal", weight=1),
            Station(name="부산", line_name="경부선", train_type="ktx", requires_transfer=False, lat=35.1152, lng=129.0408, region_type="normal", weight=1),
            Station(name="강릉", line_name="경강선", train_type="ktx", requires_transfer=False, lat=37.7642, lng=128.8960, region_type="normal", weight=2),
            Station(name="정동진", line_name="동해산타열차", train_type="santa", requires_transfer=True, lat=37.6900, lng=129.0333, region_type="depopulated", weight=5),
            Station(name="삼척", line_name="동해산타열차", train_type="santa", requires_transfer=True, lat=37.4500, lng=129.1650, region_type="depopulated", weight=5),
        ]
        db.add_all(mock_stations)
        await db.commit()
        print(f"Seeded {len(mock_stations)} mock stations")


asyncio.run(seed())
