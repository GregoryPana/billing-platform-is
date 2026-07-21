import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, default="")
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    password_hash = Column(String(255), nullable=False, default="")
    external_provider = Column(String(50))
    external_subject = Column(String(255), unique=True)
    last_seen_role = Column(String(50))
    last_seen_groups = Column(JSONB, nullable=False, default=list)
    last_login_at = Column(DateTime(timezone=True))
    auth_metadata = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
