from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.auth.csrf import add_origin_check
from app.config import SettingsDep, get_settings
from app.routers import ai, auth, todos


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db.migrate()
    yield


app = FastAPI(title="AI Todo App API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,  # allow the session cookie on calls from the listed origins
    allow_methods=["*"],
    allow_headers=["*"],
)
add_origin_check(app, get_settings().cors_origins)

app.include_router(auth.router)
app.include_router(todos.router)
app.include_router(ai.router)


@app.get("/api/health")
def health(settings: SettingsDep) -> dict:
    """Liveness check. Also tells the frontend whether AI features can be used."""
    return {"status": "ok", "ai_enabled": settings.ai_enabled}
