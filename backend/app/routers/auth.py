import math

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.auth import sessions
from app.auth.deps import CurrentUser, SessionDep
from app.auth.passwords import hash_password, password_problem, verify_password
from app.auth.ratelimit import login_limiter
from app.config import SettingsDep
from app.models import LoginRequest, SignupRequest, User, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])

WRONG_CREDENTIALS = "Email or password is incorrect."


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(
    data: SignupRequest, request: Request, response: Response, db: SessionDep, settings: SettingsDep
) -> UserRead:
    """Create an account with a password and sign in."""
    if problem := password_problem(data.password, data.email):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, problem)

    taken = "An account with this email already exists. Sign in instead."
    if db.exec(select(User).where(User.email == data.email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, taken)
    user = User(email=data.email, name=data.name, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups with the same email at the same moment
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, taken) from None
    db.refresh(user)

    sessions.sign_in(db, user, request, response, settings.cookie_secure)
    return UserRead.from_user(user)


@router.post("/login", response_model=UserRead)
def login(
    data: LoginRequest, request: Request, response: Response, db: SessionDep, settings: SettingsDep
) -> UserRead:
    """Sign in with email and password. A wrong email and a wrong password get the same answer."""
    key = (data.email, request.client.host if request.client else "unknown")
    if wait := login_limiter.retry_after(key):
        minutes = math.ceil(wait / 60)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
            headers={"Retry-After": str(wait)},
        )

    user = db.exec(select(User).where(User.email == data.email)).first()
    ok, new_hash = verify_password(data.password, user.password_hash if user else None)
    if not ok:
        login_limiter.record_failure(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, WRONG_CREDENTIALS)
    login_limiter.reset(key)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
    if new_hash:
        user.password_hash = new_hash

    sessions.sign_in(db, user, request, response, settings.cookie_secure)
    return UserRead.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: SessionDep, settings: SettingsDep) -> None:
    """End this browser's session. Safe to call when already signed out."""
    sessions.end_session(db, request.cookies.get(sessions.COOKIE_NAME))
    sessions.clear_session_cookie(response, settings.cookie_secure)


@router.get("/config")
def auth_config(settings: SettingsDep) -> dict:
    """Which ways to sign in are switched on, so the UI shows the right buttons."""
    return {"password": True, "google": settings.google_enabled}


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    """The signed-in user, or 401. The frontend calls this on startup."""
    return UserRead.from_user(user)
