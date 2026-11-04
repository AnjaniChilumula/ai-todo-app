from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import select

from app.auth import sessions
from app.auth.deps import CurrentUser, SessionDep
from app.auth.devices import describe_user_agent
from app.auth.passwords import hash_password, password_problem, verify_password
from app.config import SettingsDep
from app.models import UserRead, UserSession, as_utc, utcnow

router = APIRouter(prefix="/api/account", tags=["account"])


class AccountUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        return value


class PasswordChange(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class SessionRead(BaseModel):
    id: str  # the token's hash: safe to show, it can't be used as a cookie
    device: str
    created_at: datetime
    last_seen_at: datetime
    current: bool


@router.patch("", response_model=UserRead)
def update_account(data: AccountUpdate, user: CurrentUser, db: SessionDep) -> UserRead:
    """Change your display name. (Email changes need verification, which v2 doesn't have.)"""
    user.name = data.name
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_user(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChange, request: Request, user: CurrentUser, db: SessionDep
) -> None:
    """Change your password, or set a first one for an account made with Google.

    Every other device is signed out, so a stolen session stops working once you change it.
    """
    if user.password_hash is not None:
        ok, _ = verify_password(data.current_password or "", user.password_hash)
        if not ok:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if problem := password_problem(data.new_password, user.email):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, problem)

    user.password_hash = hash_password(data.new_password)
    db.add(user)
    db.commit()
    sessions.end_all_sessions(db, user.id, keep_session_id=request.state.session_id)


@router.get("/sessions", response_model=list[SessionRead])
def list_sessions(request: Request, user: CurrentUser, db: SessionDep) -> list[SessionRead]:
    """The devices you're signed in on: this one first, then the most recently active."""
    current_id = request.state.session_id
    now = utcnow()
    rows = db.exec(select(UserSession).where(UserSession.user_id == user.id)).all()
    active = [row for row in rows if as_utc(row.expires_at) > now]
    active.sort(key=lambda row: (row.id != current_id, -as_utc(row.last_seen_at).timestamp()))
    return [
        SessionRead(
            id=row.id,
            device=describe_user_agent(row.user_agent),
            created_at=as_utc(row.created_at),
            last_seen_at=as_utc(row.last_seen_at),
            current=row.id == current_id,
        )
        for row in active
    ]


@router.delete("/sessions", status_code=status.HTTP_200_OK)
def end_other_sessions(request: Request, user: CurrentUser, db: SessionDep, others: bool) -> dict:
    """Sign out everywhere except this device: DELETE /api/account/sessions?others=true."""
    if not others:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only others=true is supported")
    ended = sessions.end_all_sessions(db, user.id, keep_session_id=request.state.session_id)
    return {"ended": ended}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def end_one_session(
    session_id: str,
    request: Request,
    response: Response,
    user: CurrentUser,
    db: SessionDep,
    settings: SettingsDep,
) -> None:
    """Sign out one device. Ending this device's own session signs you out here too."""
    row = db.get(UserSession, session_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    db.delete(row)
    db.commit()
    if session_id == request.state.session_id:
        sessions.clear_session_cookie(response, settings.cookie_secure)
