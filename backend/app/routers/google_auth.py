from typing import Annotated

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.auth import sessions
from app.auth.deps import SessionDep
from app.auth.google import account_for_google, get_google
from app.config import Settings, SettingsDep

router = APIRouter(prefix="/api/auth/google", tags=["auth"])

GoogleDep = Annotated[object, Depends(get_google)]


def _back_to_sign_in(settings: Settings, reason: str) -> RedirectResponse:
    """Send the browser to the sign-in page with a reason the UI turns into a message."""
    return RedirectResponse(f"{settings.app_url.rstrip('/')}/login?error={reason}", status_code=303)


@router.get("/start")
async def google_start(request: Request, google: GoogleDep, settings: SettingsDep):
    """The "Continue with Google" button links here; we send the browser on to Google."""
    return await google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/callback")
async def google_callback(
    request: Request, google: GoogleDep, db: SessionDep, settings: SettingsDep
) -> RedirectResponse:
    """Google sends the browser back here. Authlib checks state, exchanges the code and verifies
    the ID token; then we sign the matching account in and go to the app."""
    try:
        token = await google.authorize_access_token(request)
    except OAuthError:
        # Wrong or missing state, the user pressed Cancel, an expired code, a bad ID token...
        return _back_to_sign_in(settings, "google_failed")

    claims = token.get("userinfo") or {}
    if not claims.get("sub") or not claims.get("email") or claims.get("email_verified") is not True:
        return _back_to_sign_in(settings, "google_unverified")

    user = account_for_google(db, claims)
    if user is None:
        return _back_to_sign_in(settings, "google_conflict")
    if not user.is_active:
        return _back_to_sign_in(settings, "disabled")

    response = RedirectResponse(f"{settings.app_url.rstrip('/')}/", status_code=303)
    sessions.sign_in(db, user, request, response, settings.cookie_secure)
    return response
