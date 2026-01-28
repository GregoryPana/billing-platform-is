from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


class ApprovalRequestSettings(Base):
    __tablename__ = "approval_request_settings"

    id = Column(Integer, primary_key=True, index=True)
    requester_name = Column(String(255), nullable=False, default="")
    billing_email = Column(String(255), nullable=False, default="information-system@cwseychelles.com")
    default_message = Column(String(1000), nullable=False, default="")
    finance_recipients = Column(JSON, nullable=False, default=list)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
