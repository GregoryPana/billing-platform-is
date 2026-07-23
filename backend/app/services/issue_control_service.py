from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.billing_issue import BillingIssue
from app.services.audit_service import record_audit_event


def count_open_finance_test_review_issues(db: Session, billing_cycle_id: UUID | str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(BillingIssue)
            .where(
                BillingIssue.billing_cycle_id == billing_cycle_id,
                BillingIssue.context == "finance_test_review",
                BillingIssue.status == "open",
            )
        )
        or 0
    )


def ensure_move_to_live_not_blocked(
    db: Session,
    billing_cycle_id: UUID | str,
    actor_id: str | None = None,
    actor_type: str | None = None,
) -> None:
    """Server-authoritative Move to Live gate (docs/FINANCE_ISSUE_CONTROL_DESIGN.md
    section 6): every open finance_test_review issue blocks approval, regardless
    of what the frontend does or does not show. Deliberately returns only the
    open issue count, not issue detail, in the error payload.

    Records a "move_to_live_blocked" audit event on every block - this is the
    source-of-truth data for the Task 8 "cycles blocked by an open issue"
    reporting metric, since blocked attempts are not otherwise persisted
    anywhere (the gate itself is a pure query + raise)."""
    open_issue_count = count_open_finance_test_review_issues(db, billing_cycle_id)
    if open_issue_count:
        record_audit_event(
            db,
            actor_id,
            actor_type or "user",
            "move_to_live_blocked",
            "billing_cycle",
            str(billing_cycle_id),
            {"open_issue_count": open_issue_count},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Move to Live is blocked by open Finance review issues",
                "open_issue_count": open_issue_count,
            },
        )
