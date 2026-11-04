from enum import StrEnum

from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth.deps import CurrentUser, SessionDep
from app.models import Todo, TodoCreate, TodoRead, TodoUpdate, User, utcnow

router = APIRouter(prefix="/api/todos", tags=["todos"])


class StatusFilter(StrEnum):
    all = "all"
    active = "active"
    completed = "completed"


def owned_by(user: User):
    """Query for the user's own tasks. Every endpoint here starts from this."""
    return select(Todo).where(Todo.owner_id == user.id)


def get_todo_or_404(session: Session, user: User, todo_id: int) -> Todo:
    """The user's task, or 404. Someone else's task is also 404, so its existence isn't revealed."""
    todo = session.get(Todo, todo_id)
    if todo is None or todo.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return todo


@router.get("", response_model=list[TodoRead])
def list_todos(
    session: SessionDep, user: CurrentUser, status: StatusFilter = StatusFilter.all
) -> list[Todo]:
    """List your tasks and subtasks in the order they were created."""
    query = owned_by(user).order_by(col(Todo.id))
    if status is StatusFilter.active:
        query = query.where(col(Todo.completed).is_(False))
    elif status is StatusFilter.completed:
        query = query.where(col(Todo.completed).is_(True))
    return list(session.exec(query))


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(data: TodoCreate, session: SessionDep, user: CurrentUser) -> Todo:
    """Create a task, or a subtask of one of your tasks when parent_id is given."""
    if data.parent_id is not None:
        parent = session.get(Todo, data.parent_id)
        if parent is None or parent.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent task not found")
        if parent.parent_id is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subtasks cannot have subtasks")
    todo = Todo.model_validate(data, update={"owner_id": user.id})
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return todo


@router.delete("")
def clear_completed(session: SessionDep, user: CurrentUser, completed: bool) -> dict:
    """Delete your completed tasks (and the subtasks of completed tasks).

    Called as DELETE /api/todos?completed=true. The explicit flag guards against wiping everything
    by accident.
    """
    if not completed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only completed=true is supported")
    done = list(session.exec(owned_by(user).where(col(Todo.completed).is_(True))))
    done_ids = {todo.id for todo in done}
    orphans = session.exec(owned_by(user).where(col(Todo.parent_id).in_(done_ids)))
    deleted = {todo.id: todo for todo in [*done, *orphans]}
    for todo in deleted.values():
        session.delete(todo)
    session.commit()
    return {"deleted": len(deleted)}


@router.patch("/{todo_id}", response_model=TodoRead)
def update_todo(todo_id: int, data: TodoUpdate, session: SessionDep, user: CurrentUser) -> Todo:
    """Change only the fields that were sent, e.g. {"completed": true}."""
    todo = get_todo_or_404(session, user, todo_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("title", "") is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Title cannot be empty")
    todo.sqlmodel_update(changes)
    todo.updated_at = utcnow()
    session.add(todo)
    session.commit()
    session.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int, session: SessionDep, user: CurrentUser) -> None:
    """Delete one of your tasks together with its subtasks."""
    todo = get_todo_or_404(session, user, todo_id)
    for subtask in session.exec(owned_by(user).where(Todo.parent_id == todo_id)):
        session.delete(subtask)
    session.delete(todo)
    session.commit()
