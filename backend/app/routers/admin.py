from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import col, func, select

from app.auth import sessions
from app.auth.deps import AdminUser, SessionDep
from app.models import Role, Todo, User, UserSession, as_utc

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminUserRead(BaseModel):
    """What admins see about an account: counts and activity, never task contents."""

    id: int
    email: str
    name: str
    role: Role
    is_active: bool
    task_count: int
    created_at: datetime
    last_active_at: datetime | None


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: Role | None = None


def _read(user: User, task_count: int, last_seen: datetime | None) -> AdminUserRead:
    times = [as_utc(t) for t in (last_seen, user.last_login_at) if t is not None]
    return AdminUserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        task_count=task_count,
        created_at=as_utc(user.created_at),
        last_active_at=max(times) if times else None,
    )


def _task_counts(db) -> dict[int, int]:
    rows = db.exec(
        select(Todo.owner_id, func.count())
        .where(col(Todo.owner_id).is_not(None))
        .group_by(Todo.owner_id)
    ).all()
    return dict(rows)


def _last_seen(db) -> dict[int, datetime]:
    rows = db.exec(
        select(UserSession.user_id, func.max(UserSession.last_seen_at)).group_by(
            UserSession.user_id
        )
    ).all()
    return dict(rows)


@router.get("/users", response_model=list[AdminUserRead])
def list_users(admin: AdminUser, db: SessionDep) -> list[AdminUserRead]:
    """Every account, oldest first, with how many tasks it has and when it was last active."""
    counts, seen = _task_counts(db), _last_seen(db)
    users = db.exec(select(User).order_by(col(User.id))).all()
    return [_read(user, counts.get(user.id, 0), seen.get(user.id)) for user in users]


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int, data: AdminUserUpdate, admin: AdminUser, db: SessionDep
) -> AdminUserRead:
    """Disable/enable an account or change its role. Disabling signs it out everywhere.

    Admins can't change their own account, so there is always at least one admin and nobody
    locks themselves out by accident.
    """
    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't change your own account here.")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    if data.is_active is False:
        sessions.end_all_sessions(db, user.id)

    return _read(user, _task_counts(db).get(user.id, 0), _last_seen(db).get(user.id))
