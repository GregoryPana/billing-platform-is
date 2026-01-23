from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class NotificationRequest(BaseSchema):
    billing_cycle_id: str
    channel: str
    recipient: str
    subject: str
    message: str


class NotificationRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    channel: str
    recipient: str
    subject: str
    message: str
    status: str
    sent_at: datetime | None = None
    created_at: datetime
