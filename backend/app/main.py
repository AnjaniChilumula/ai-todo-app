from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app import db
from app.auth.csrf import add_origin_check
from app.config import SettingsDep, get_settings
from app.routers import account, admin, ai, auth, google_auth, todos


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
# Only for Google sign-in: a signed, 10-minute cookie that carries the OAuth state, nonce and PKCE
# verifier from /api/auth/google/start to the callback. Sign-in sessions don't use it.
app.add_middleware(
    SessionMiddleware,
    secret_key=get_settings().secret_key,
    session_cookie="oauth_state",
    max_age=600,
    same_site="lax",
    https_only=get_settings().cookie_secure,
)

app.include_router(auth.router)
app.include_router(google_auth.router)
app.include_router(account.router)
app.include_router(admin.router)
app.include_router(todos.router)
app.include_router(ai.router)


@app.get("/api/health")
def health(settings: SettingsDep) -> dict:
    """Liveness check. Also tells the frontend whether AI features can be used."""
    return {"status": "ok", "ai_enabled": settings.ai_enabled}
