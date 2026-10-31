from datetime import datetime
from functools import lru_cache
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.ai.client import AIError, TodoAI
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Priority, Todo, as_utc

router = APIRouter(prefix="/api/ai", tags=["ai"])


@lru_cache
def _make_ai(api_key: str, model: str) -> TodoAI:
    return TodoAI(api_key=api_key, model=model)


def get_ai(settings: Annotated[Settings, Depends(get_settings)]) -> TodoAI:
    """FastAPI dependency: the Claude wrapper, or 503 when no API key is configured."""
    if not settings.ai_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AI features are off. Add ANTHROPIC_API_KEY to backend/.env and restart the server.",
        )
    return _make_ai(settings.anthropic_api_key, settings.anthropic_model)


AIDep = Annotated[TodoAI, Depends(get_ai)]
SessionDep = Annotated[Session, Depends(get_session)]


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    timezone: str = Field(default="UTC", description="IANA timezone, e.g. Asia/Kolkata")


class ParseResponse(BaseModel):
    """A suggestion only: nothing is saved until the user confirms it."""

    title: str
    notes: str | None
    due_at: datetime | None
    priority: Priority


def _read_due_at(value: str | None, tz: ZoneInfo) -> datetime | None:
    """Turn the AI's ISO date into UTC. An unreadable date is dropped rather than failing."""
    if not value:
        return None
    try:
        due_at = datetime.fromisoformat(value)
    except ValueError:
        return None
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=tz)
    return as_utc(due_at)


@router.post("/parse", response_model=ParseResponse)
def parse_task(data: ParseRequest, ai: AIDep) -> ParseResponse:
    """Smart Add: turn "call mom tomorrow 6pm, high priority" into task fields."""
    try:
        tz = ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown timezone") from None

    try:
        parsed = ai.parse_task(data.text, datetime.now(tz))
    except AIError as err:
        raise HTTPException(err.status_code, err.message) from err

    return ParseResponse(
        title=parsed.title.strip()[:200] or data.text.strip()[:200],
        notes=(parsed.notes or "").strip() or None,
        due_at=_read_due_at(parsed.due_at, tz),
        priority=parsed.priority,
    )


class BreakdownRequest(BaseModel):
    todo_id: int


class BreakdownResponse(BaseModel):
    """Suggestions only: the user picks which ones to add as subtasks."""

    subtasks: list[str]


@router.post("/breakdown", response_model=BreakdownResponse)
def breakdown(data: BreakdownRequest, ai: AIDep, session: SessionDep) -> BreakdownResponse:
    """Break it down: suggest subtasks for a task, skipping the ones it already has."""
    todo = session.get(Todo, data.todo_id)
    if todo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if todo.parent_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subtasks cannot be broken down further")

    existing = [sub.title for sub in session.exec(select(Todo).where(Todo.parent_id == todo.id))]
    try:
        suggestions = ai.suggest_subtasks(todo.title, todo.notes, existing)
    except AIError as err:
        raise HTTPException(err.status_code, err.message) from err
    return BreakdownResponse(subtasks=suggestions)
