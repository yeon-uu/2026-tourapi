from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from sqlalchemy import select

from app.database import Base, async_session, engine
from app.models import *  # noqa: F401, F403 — register all models with Base.metadata
from app.models.station import Station
from app.routers import auth, checklist, gacha, stamp, station
from app.utils.rate_limit import limiter


async def seed_stations():
    async with async_session() as db:
        result = await db.execute(select(Station))
        if result.scalars().first():
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_stations()
    yield
    await engine.dispose()


app = FastAPI(title="AI-DO API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:80", "http://15.134.178.157"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(gacha.router)
app.include_router(checklist.router)
app.include_router(stamp.router)
app.include_router(station.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "ok"}
