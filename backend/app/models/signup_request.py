import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class SignupRequest(Base):
    __tablename__ = "signup_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    assigned_role = Column(String(50))
    reviewed_by = Column(UUID(as_uuid=True))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
