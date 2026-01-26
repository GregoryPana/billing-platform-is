from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class NotificationRequest(BaseSchema):
    billing_cycle_id: str


class NotificationRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    message: str
    status: str
    created_at: datetime
