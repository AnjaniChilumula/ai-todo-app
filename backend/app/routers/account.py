from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from app.auth.deps import CurrentUser, SessionDep
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


@router.patch("", response_model=UserRead)
def update_account(data: AccountUpdate, user: CurrentUser, db: SessionDep) -> UserRead:
    """Change your display name. (Email changes need verification, which v2 doesn't have.)"""
    user.name = data.name
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_user(user)
