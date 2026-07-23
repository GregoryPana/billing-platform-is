import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.utils.datetime_utils import utc_plus_4_now


ISSUE_CONTEXTS = ("execution_issue", "finance_test_review", "post_live_observation")
ISSUE_STATUSES = ("open", "completed")
COMPLETION_OUTCOMES = ("resolved", "raised_in_error")

# "finance_review" classifications are shared by finance_test_review and
# post_live_observation issues (docs/FINANCE_ISSUE_CONTROL_DESIGN.md section 4:
# "The initial controlled classification list applies to Finance test-review
# issues and post-live observations"). "execution_issue" classifications are an
# operational list "to be agreed during implementation" and are not seeded yet.
CLASSIFICATION_CONTEXTS = ("finance_review", "execution_issue")


class BillingIssueClassification(Base):
    __tablename__ = "billing_issue_classifications"
    __table_args__ = (
        CheckConstraint(
            f"context IN {CLASSIFICATION_CONTEXTS}", name="ck_billing_issue_classifications_context"
        ),
        UniqueConstraint("context", "name", name="uq_billing_issue_classifications_context_name"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    context = Column(String(30), nullable=False)
    name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    # Deactivate, never delete - classifications may already be referenced by
    # historical issues and must remain valid for reporting.
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)


class BillingIssue(Base):
    __tablename__ = "billing_issues"
    __table_args__ = (
        CheckConstraint(f"context IN {ISSUE_CONTEXTS}", name="ck_billing_issues_context"),
        CheckConstraint(f"status IN {ISSUE_STATUSES}", name="ck_billing_issues_status"),
        CheckConstraint(
            f"completion_outcome IS NULL OR completion_outcome IN {COMPLETION_OUTCOMES}",
            name="ck_billing_issues_completion_outcome",
        ),
        CheckConstraint(
            "(status = 'open' AND completion_outcome IS NULL AND completed_by IS NULL AND completed_at IS NULL) "
            "OR (status = 'completed' AND completion_outcome IS NOT NULL AND completed_by IS NOT NULL "
            "AND completed_at IS NOT NULL)",
            name="ck_billing_issues_completion_requires_outcome_actor_time",
        ),
        CheckConstraint(
            "completion_outcome IS DISTINCT FROM 'raised_in_error' OR completion_comment IS NOT NULL",
            name="ck_billing_issues_raised_in_error_requires_comment",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_cycle_id = Column(UUID(as_uuid=True), ForeignKey("billing_cycles.id"), nullable=False)
    context = Column(String(30), nullable=False)
    related_script_run_id = Column(UUID(as_uuid=True), ForeignKey("script_runs.id"))
    classification_id = Column(
        UUID(as_uuid=True), ForeignKey("billing_issue_classifications.id"), nullable=False
    )
    title = Column(String(255), nullable=False)
    detail = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open")
    completion_outcome = Column(String(20))
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    completed_at = Column(DateTime(timezone=True))
    completion_comment = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_plus_4_now, nullable=False)
