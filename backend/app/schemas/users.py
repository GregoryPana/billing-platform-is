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
