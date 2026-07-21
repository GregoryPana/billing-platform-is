import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


ACTIVITY_TYPES = ("created", "comment", "edited", "completed", "reopened")


class BillingIssueActivity(Base):
    __tablename__ = "billing_issue_activities"
    __table_args__ = (
        CheckConstraint(f"activity_type IN {ACTIVITY_TYPES}", name="ck_billing_issue_activities_activity_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_issue_id = Column(UUID(as_uuid=True), ForeignKey("billing_issues.id"), nullable=False)
    activity_type = Column(String(30), nullable=False)
    # Append-only: comments/edits are never overwritten, only added.
    comment = Column(Text)
    before_state = Column(JSONB)
    after_state = Column(JSONB)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
