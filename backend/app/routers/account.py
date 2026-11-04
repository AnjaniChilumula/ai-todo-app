from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.auth import sessions
from app.auth.deps import CurrentUser, SessionDep
from app.auth.passwords import hash_password, password_problem, verify_password
from app.models import UserRead

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
