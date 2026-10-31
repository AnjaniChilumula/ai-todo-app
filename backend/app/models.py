from datetime import UTC, datetime
from enum import StrEnum

from pydantic import field_validator
from sqlmodel import Field, SQLModel


class Priority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


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
