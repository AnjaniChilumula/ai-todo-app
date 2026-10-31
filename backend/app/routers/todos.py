from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Todo, TodoCreate, TodoRead

router = APIRouter(prefix="/api/todos", tags=["todos"])

SessionDep = Annotated[Session, Depends(get_session)]


class StatusFilter(StrEnum):
    all = "all"
    active = "active"
    completed = "completed"


@router.get("", response_model=list[TodoRead])
def list_todos(session: SessionDep, status: StatusFilter = StatusFilter.all) -> list[Todo]:
    """List tasks and subtasks in the order they were created."""
    query = select(Todo).order_by(col(Todo.id))
    if status is StatusFilter.active:
        query = query.where(col(Todo.completed).is_(False))
    elif status is StatusFilter.completed:
        query = query.where(col(Todo.completed).is_(True))
    return list(session.exec(query))


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(data: TodoCreate, session: SessionDep) -> Todo:
    """Create a task, or a subtask when parent_id is given."""
    if data.parent_id is not None:
        parent = session.get(Todo, data.parent_id)
        if parent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent task not found")
        if parent.parent_id is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subtasks cannot have subtasks")
    todo = Todo.model_validate(data)
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return todo
