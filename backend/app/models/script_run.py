import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class ScriptRun(Base):
    __tablename__ = "script_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_definition_id = Column(UUID(as_uuid=True), ForeignKey("script_definitions.id"), nullable=False)
    status = Column(String(20), nullable=False)
    run_timestamp = Column(DateTime(timezone=True))
    run_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
