import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_cycle_id = Column(UUID(as_uuid=True), ForeignKey("billing_cycles.id"), nullable=False)
    stage = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
