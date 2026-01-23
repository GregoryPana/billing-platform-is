import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class ScriptDefinition(Base):
    __tablename__ = "script_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_cycle_id = Column(UUID(as_uuid=True), ForeignKey("billing_cycles.id"), nullable=False)
    environment = Column(String(10), nullable=False)
    script_type = Column(String(20), nullable=False)
    log_type = Column(String(10), nullable=False)
    parameters = Column(JSONB, nullable=False)
    command_text = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
