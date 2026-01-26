from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class UserRead(BaseSchema):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseSchema):
    username: str
    email: str
    role: str
    password: str
    is_active: bool = True


class UserUpdate(BaseSchema):
    username: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
