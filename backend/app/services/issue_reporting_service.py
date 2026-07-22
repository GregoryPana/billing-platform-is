from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.billing_cycle import BillingCycle
from app.models.billing_issue import BillingIssue, BillingIssueClassification


def _cycle_scope(db: Session, billing_cycle_id, start_month, end_month):
    query = select(BillingCycle)
    if billing_cycle_id:
        query = query.where(BillingCycle.id == billing_cycle_id)
    if start_month:
        query = query.where(BillingCycle.billing_month >= start_month)
    if end_month:
        query = query.where(BillingCycle.billing_month <= end_month)
    return {cycle.id: cycle for cycle in db.scalars(query)}


def build_issue_reporting_summary(
    db: Session,
    billing_cycle_id: UUID | str | None = None,
    start_month: str | None = None,
    end_month: str | None = None,
) -> dict:
    cycles_in_scope = _cycle_scope(db, billing_cycle_id, start_month, end_month)
    cycle_ids = list(cycles_in_scope.keys())

    metrics = {
        "test_review_issues_by_cycle": _test_review_issues_by_cycle(db, cycles_in_scope, cycle_ids),
        "classification_breakdown": _classification_breakdown(db, cycle_ids),
        "test_review_vs_post_live": _test_review_vs_post_live(db, cycle_ids),
        "completion_turnaround": _completion_turnaround(db, cycle_ids),
        "cycles_blocked_by_open_issue": _cycles_blocked_by_open_issue(db, cycles_in_scope, cycle_ids),
        "raised_in_error": _raised_in_error(db, cycle_ids),
    }

    return {
        "filters": {
            "billing_cycle_id": billing_cycle_id,
            "start_month": start_month,
            "end_month": end_month,
        },
        "metrics": metrics,
    }


def _test_review_issues_by_cycle(db: Session, cycles_in_scope: dict, cycle_ids: list) -> dict:
    rows = []
    if cycle_ids:
        counts = dict(
            db.execute(
                select(BillingIssue.billing_cycle_id, func.count())
                .where(
                    BillingIssue.context == "finance_test_review",
                    BillingIssue.billing_cycle_id.in_(cycle_ids),
                )
                .group_by(BillingIssue.billing_cycle_id)
            ).all()
        )
        for cycle_id, cycle in cycles_in_scope.items():
            count = counts.get(cycle_id, 0)
            if count:
                rows.append(
                    {
                        "billing_cycle_id": str(cycle_id),
                        "usage_month": cycle.usage_month,
                        "billing_month": cycle.billing_month,
                        "count": count,
                    }
                )
    return {
        "source": "billing_issues (context=finance_test_review), grouped by billing_cycle_id",
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": "Track Finance test-review workload per cycle/month to plan review capacity",
        "is_empty": len(rows) == 0,
        "data": rows,
    }


def _classification_breakdown(db: Session, cycle_ids: list) -> dict:
    rows = []
    if cycle_ids:
        counts = db.execute(
            select(BillingIssueClassification.name, func.count())
            .join(BillingIssue, BillingIssue.classification_id == BillingIssueClassification.id)
            .where(
                BillingIssue.billing_cycle_id.in_(cycle_ids),
                BillingIssue.context.in_(("finance_test_review", "post_live_observation")),
                BillingIssue.status == "completed",
                BillingIssue.completion_outcome == "resolved",
            )
            .group_by(BillingIssueClassification.name)
        ).all()
        rows = [{"classification": name, "count": count} for name, count in counts]
    return {
        "source": (
            "billing_issues joined to billing_issue_classifications, filtered to completed issues with "
            "completion_outcome=resolved (finance_test_review and post_live_observation contexts only)"
        ),
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": "Identify the most common confirmed defect classes to prioritise root-cause fixes",
        "is_empty": len(rows) == 0,
        "data": rows,
    }


def _test_review_vs_post_live(db: Session, cycle_ids: list) -> dict:
    rows = []
    if cycle_ids:
        counts = db.execute(
            select(BillingIssue.context, func.count())
            .where(
                BillingIssue.billing_cycle_id.in_(cycle_ids),
                BillingIssue.context.in_(("finance_test_review", "post_live_observation")),
            )
            .group_by(BillingIssue.context)
        ).all()
        rows = [{"context": context, "count": count} for context, count in counts]
    return {
        "source": "billing_issues, grouped by context (finance_test_review vs post_live_observation)",
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": "See whether quality issues are caught pre-live or slip to post-live observations",
        "is_empty": len(rows) == 0,
        "data": rows,
    }


def _completion_turnaround(db: Session, cycle_ids: list) -> dict:
    hours = []
    if cycle_ids:
        seconds = db.scalars(
            select(func.extract("epoch", BillingIssue.completed_at - BillingIssue.created_at)).where(
                BillingIssue.billing_cycle_id.in_(cycle_ids),
                BillingIssue.context.in_(("finance_test_review", "post_live_observation")),
                BillingIssue.status == "completed",
            )
        ).all()
        hours = [float(value) / 3600 for value in seconds if value is not None]

    sample_size = len(hours)
    if sample_size:
        sorted_hours = sorted(hours)
        average_hours = sum(sorted_hours) / sample_size
        mid = sample_size // 2
        median_hours = (
            sorted_hours[mid] if sample_size % 2 else (sorted_hours[mid - 1] + sorted_hours[mid]) / 2
        )
        data = {
            "average_hours": round(average_hours, 2),
            "median_hours": round(median_hours, 2),
            "sample_size": sample_size,
        }
    else:
        data = {"average_hours": None, "median_hours": None, "sample_size": 0}

    return {
        "source": (
            "billing_issues completed_at minus created_at, for completed finance_test_review and "
            "post_live_observation issues"
        ),
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": "Measure Finance review turnaround time to set or monitor an SLA",
        "is_empty": sample_size == 0,
        "data": data,
    }


def _cycles_blocked_by_open_issue(db: Session, cycles_in_scope: dict, cycle_ids: list) -> dict:
    rows = []
    if cycle_ids:
        counts = dict(
            db.execute(
                select(AuditLog.entity_id, func.count())
                .where(
                    AuditLog.action == "move_to_live_blocked",
                    AuditLog.entity_type == "billing_cycle",
                    AuditLog.entity_id.in_(cycle_ids),
                )
                .group_by(AuditLog.entity_id)
            ).all()
        )
        for cycle_id, cycle in cycles_in_scope.items():
            blocked_count = counts.get(cycle_id, 0)
            if blocked_count:
                rows.append(
                    {
                        "billing_cycle_id": str(cycle_id),
                        "usage_month": cycle.usage_month,
                        "billing_month": cycle.billing_month,
                        "blocked_count": blocked_count,
                    }
                )
    return {
        "source": "audit_logs (action=move_to_live_blocked), recorded each time the server-side approval gate rejects a request",
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": "Identify how often Test approval is delayed by open Finance issues, a process bottleneck signal",
        "is_empty": len(rows) == 0,
        "data": rows,
    }


def _raised_in_error(db: Session, cycle_ids: list) -> dict:
    raised_in_error_count = 0
    completed_count = 0
    if cycle_ids:
        raised_in_error_count = (
            db.scalar(
                select(func.count())
                .select_from(BillingIssue)
                .where(
                    BillingIssue.billing_cycle_id.in_(cycle_ids),
                    BillingIssue.context.in_(("finance_test_review", "post_live_observation")),
                    BillingIssue.completion_outcome == "raised_in_error",
                )
            )
            or 0
        )
        completed_count = (
            db.scalar(
                select(func.count())
                .select_from(BillingIssue)
                .where(
                    BillingIssue.billing_cycle_id.in_(cycle_ids),
                    BillingIssue.context.in_(("finance_test_review", "post_live_observation")),
                    BillingIssue.status == "completed",
                )
            )
            or 0
        )
    percentage = round((raised_in_error_count / completed_count) * 100, 1) if completed_count else None
    return {
        "source": "billing_issues with completion_outcome=raised_in_error, out of all completed finance issues",
        "filter_scope": "billing_cycle_id, and/or billing_month between start_month and end_month",
        "decision_supported": (
            "Audit-quality measure of how often issues are raised then withdrawn as errors; deliberately "
            "excluded from headline KPI totals, not a revenue-impact figure"
        ),
        "is_empty": raised_in_error_count == 0,
        "data": {"count": raised_in_error_count, "percentage_of_completed": percentage},
    }
