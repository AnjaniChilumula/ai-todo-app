"""Cross-site request forgery (CSRF) protection.

The session cookie is SameSite=Lax, so browsers already refuse to send it with POST/PATCH/DELETE
requests started by other websites. As a second layer, any state-changing request that carries an
Origin header must come from this app's own origin or one listed in CORS_ORIGINS.

Requests without an Origin header (curl, tests, server-to-server) are allowed: they don't come with
a victim's browser cookies attached, which is what CSRF relies on.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def add_origin_check(app: FastAPI, allowed_origins: list[str]) -> None:
    allowed = {origin.rstrip("/") for origin in allowed_origins}

    @app.middleware("http")
    async def origin_check(request: Request, call_next):
        if request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            own_origin = f"{request.url.scheme}://{request.url.netloc}"
            if origin is not None and origin not in allowed and origin != own_origin:
                return JSONResponse({"detail": "Cross-site request blocked."}, status_code=403)
        return await call_next(request)
