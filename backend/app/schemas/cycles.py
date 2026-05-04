from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class BillingCycleCreate(BaseSchema):
    usage_month: str
    billing_month: str
    notes: str | None = None


class BillingCycleRead(BaseSchema):
    id: UUID
    usage_month: str
    billing_month: str
    status: str
    notes: str | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class BillingCycleStatusUpdate(BaseSchema):
    status: str
