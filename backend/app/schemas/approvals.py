from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class ApprovalRequest(BaseSchema):
    billing_cycle_id: str
    stage: str
    status: str
    comments: str | None = None


class ApprovalRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    stage: str
    status: str
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    comments: str | None = None
    created_at: datetime
    updated_at: datetime
