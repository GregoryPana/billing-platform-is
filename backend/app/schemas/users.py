from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class UserRead(BaseSchema):
    id: UUID
    name: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseSchema):
    name: str | None = None
    username: str | None = None
    email: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None
