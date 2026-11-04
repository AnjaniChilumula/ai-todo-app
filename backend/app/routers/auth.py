from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.auth import sessions
from app.auth.deps import CurrentUser, SessionDep
from app.auth.passwords import hash_password, password_problem, verify_password
from app.config import Settings, SettingsDep
from app.models import LoginRequest, SignupRequest, User, UserRead, utcnow

router = APIRouter(prefix="/api/auth", tags=["auth"])

WRONG_CREDENTIALS = "Email or password is incorrect."


def _sign_in(db: Session, user: User, request: Request, response: Response, settings: Settings):
    """Give the browser a brand-new session (a new token on every sign-in prevents session
    fixation) and drop the one it had before, if any."""
    sessions.end_session(db, request.cookies.get(sessions.COOKIE_NAME))
    token = sessions.create_session(db, user, request.headers.get("user-agent"))
    sessions.set_session_cookie(response, token, settings.cookie_secure)
    user.last_login_at = utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)


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

    _sign_in(db, user, request, response, settings)
    return UserRead.from_user(user)


@router.post("/login", response_model=UserRead)
def login(
    data: LoginRequest, request: Request, response: Response, db: SessionDep, settings: SettingsDep
) -> UserRead:
    """Sign in with email and password. A wrong email and a wrong password get the same answer."""
    user = db.exec(select(User).where(User.email == data.email)).first()
    ok, new_hash = verify_password(data.password, user.password_hash if user else None)
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, WRONG_CREDENTIALS)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled.")
    if new_hash:
        user.password_hash = new_hash

    _sign_in(db, user, request, response, settings)
    return UserRead.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: SessionDep, settings: SettingsDep) -> None:
    """End this browser's session. Safe to call when already signed out."""
    sessions.end_session(db, request.cookies.get(sessions.COOKIE_NAME))
    sessions.clear_session_cookie(response, settings.cookie_secure)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    """The signed-in user, or 401. The frontend calls this on startup."""
    return UserRead.from_user(user)
