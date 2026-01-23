import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class BillingCycle(Base):
    __tablename__ = "billing_cycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usage_month = Column(String(7), nullable=False)
    billing_month = Column(String(7), nullable=False)
    status = Column(String(50), nullable=False, default="draft")
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
