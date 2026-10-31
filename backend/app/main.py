from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.config import Settings, get_settings
from app.routers import ai, todos

SettingsDep = Annotated[Settings, Depends(get_settings)]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db.init_db()
    yield


app = FastAPI(title="AI Todo App API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(todos.router)
app.include_router(ai.router)


@app.get("/api/health")
def health(settings: SettingsDep) -> dict:
    """Liveness check. Also tells the frontend whether AI features can be used."""
    return {"status": "ok", "ai_enabled": settings.ai_enabled}
