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
from app.seed_data import build_station_list
from app.utils.rate_limit import limiter


async def seed_stations():
    """80개 역 시드 데이터 삽입 (DB 비어있을 때만)"""
    async with async_session() as db:
        result = await db.execute(select(Station))
        if result.scalars().first():
            return
        stations = [Station(**s) for s in build_station_list()]
        db.add_all(stations)
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
