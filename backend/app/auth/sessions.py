"""Server-side sessions.

The browser gets a random token in an HttpOnly cookie. The database stores only the token's
SHA-256 hash, so a copy of the database can't be used to sign in as anyone.
"""

import hashlib
import secrets
from datetime import timedelta

from fastapi import Response
from sqlmodel import Session, col, delete

from app.models import User, UserSession, as_utc, utcnow

COOKIE_NAME = "session"
IDLE_TIMEOUT = timedelta(days=14)  # signed out after 14 days without a visit...
MAX_AGE = timedelta(days=30)  # ...and after 30 days at most, however active
TOUCH_INTERVAL = timedelta(minutes=1)  # don't write to the database on every request


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, user_agent: str | None) -> str:
    """Start a session for the user and return the token to put in the cookie."""
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.add(
        UserSession(
            id=hash_token(token),
            user_id=user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + IDLE_TIMEOUT,
            user_agent=(user_agent or "")[:300],
        )
    )
    db.commit()
    return token


def load_session(db: Session, token: str | None) -> tuple[UserSession, User] | None:
    """Return the session and its user, or None if the token is unknown, expired or the account
    is disabled. Active sessions slide forward by the idle timeout, capped at MAX_AGE."""
    if not token:
        return None
    row = db.get(UserSession, hash_token(token))
    if row is None:
        return None

    now = utcnow()
    if as_utc(row.expires_at) <= now:
        db.delete(row)
        db.commit()
        return None

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        return None

    if now - as_utc(row.last_seen_at) >= TOUCH_INTERVAL:
        row.last_seen_at = now
        row.expires_at = min(now + IDLE_TIMEOUT, as_utc(row.created_at) + MAX_AGE)
        db.add(row)
        db.commit()
    return row, user


def end_session(db: Session, token: str | None) -> None:
    if not token:
        return
    row = db.get(UserSession, hash_token(token))
    if row is not None:
        db.delete(row)
        db.commit()


def end_all_sessions(db: Session, user_id: int, keep_session_id: str | None = None) -> int:
    """Sign a user out everywhere, optionally keeping one session (the current device).
    Returns how many sessions were ended."""
    query = delete(UserSession).where(col(UserSession.user_id) == user_id)
    if keep_session_id is not None:
        query = query.where(col(UserSession.id) != keep_session_id)
    result = db.exec(query)
    db.commit()
    return result.rowcount


def set_session_cookie(response: Response, token: str, secure: bool) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(MAX_AGE.total_seconds()),
        httponly=True,  # page scripts can't read it, so an XSS bug can't steal it
        samesite="lax",  # not sent on cross-site POST/PATCH/DELETE
        secure=secure,  # HTTPS only, when the app is served over HTTPS
        path="/",
    )


def clear_session_cookie(response: Response, secure: bool) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax", secure=secure)
