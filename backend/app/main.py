from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings

SettingsDep = Annotated[Settings, Depends(get_settings)]

app = FastAPI(title="AI Todo App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(settings: SettingsDep) -> dict:
    """Liveness check. Also tells the frontend whether AI features can be used."""
    return {"status": "ok", "ai_enabled": settings.ai_enabled}
