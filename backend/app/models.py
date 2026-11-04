from datetime import UTC, datetime
from enum import StrEnum

from pydantic import EmailStr, field_validator
from sqlmodel import Field, SQLModel


class Priority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class Role(StrEnum):
    user = "user"
    admin = "admin"


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    """Store and return every datetime in UTC.

    SQLite has no timezone support, so values are saved as UTC wall-clock time and marked as UTC
    again when read back. Naive input is assumed to already be UTC.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class TodoBase(SQLModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    due_at: datetime | None = None
    priority: Priority = Priority.medium

    @field_validator("due_at")
    @classmethod
    def _due_at_utc(cls, value: datetime | None) -> datetime | None:
        return as_utc(value)


class Todo(TodoBase, table=True):
    """A task, or a subtask when parent_id is set."""

    id: int | None = Field(default=None, primary_key=True)
    completed: bool = False
    parent_id: int | None = Field(default=None, foreign_key="todo.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class TodoCreate(TodoBase):
    parent_id: int | None = None


class TodoUpdate(SQLModel):
    """Every field is optional: only the fields sent are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None
    due_at: datetime | None = None
    priority: Priority | None = None
    completed: bool | None = None

    @field_validator("due_at")
    @classmethod
    def _due_at_utc(cls, value: datetime | None) -> datetime | None:
        return as_utc(value)


class TodoRead(TodoBase):
    id: int
    completed: bool
    parent_id: int | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def _timestamps_utc(cls, value: datetime) -> datetime:
        return as_utc(value)


# --- Accounts and sessions -------------------------------------------------------------------


class User(SQLModel, table=True):
    """An account. Google-only accounts have no password_hash."""

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(max_length=254, unique=True, index=True)  # always stored lower-case
    name: str = Field(max_length=80)
    password_hash: str | None = Field(default=None, max_length=255)
    role: Role = Role.user
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    last_login_at: datetime | None = None


class UserSession(SQLModel, table=True):
    """A signed-in browser. The cookie holds a random token; only its SHA-256 hash is stored."""

    __tablename__ = "user_sessions"

    id: str = Field(primary_key=True, max_length=64)  # sha256(token) as hex
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    last_seen_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
    user_agent: str = Field(default="", max_length=300)


class SignupRequest(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()


class LoginRequest(SQLModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()


class UserRead(SQLModel):
    """What the API shows about an account: never the password hash."""

    id: int
    email: str
    name: str
    role: Role
    has_password: bool
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserRead":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            has_password=user.password_hash is not None,
            created_at=as_utc(user.created_at),
        )
