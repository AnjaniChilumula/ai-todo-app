"""FastAPI dependencies for "who is signed in" and "are they allowed"."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from app.auth import sessions
from app.db import get_session
from app.models import Role, User

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(request: Request, db: SessionDep) -> User:
    """The signed-in user, or 401. Also remembers which session made the request."""
    found = sessions.load_session(db, request.cookies.get(sessions.COOKIE_NAME))
    if found is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in.")
    session_row, user = found
    request.state.session_id = session_row.id
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can do that.")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
