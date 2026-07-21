from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.approval import Approval
from app.models.billing_cycle import BillingCycle
from app.models.billing_issue import BillingIssue, BillingIssueClassification
from app.models.billing_issue_activity import BillingIssueActivity
from app.models.script_run import ScriptRun
from app.schemas.issues import (
    BillingIssueActivityRead,
    BillingIssueClassificationRead,
    BillingIssueCommentCreate,
    BillingIssueCompletionRequest,
    BillingIssueCreate,
    BillingIssueEditRequest,
    BillingIssueRead,
    BillingIssueReopenRequest,
)
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, get_current_actor, normalize_role, require_role, role_set
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()

ALL_ROLES = role_set("system_admin", "billing_user", "finance_user")
FINANCE_ROLES = role_set("system_admin", "finance_user")
FINANCE_ISSUE_CONTEXTS = ("finance_test_review", "post_live_observation")


def _get_issue_or_404(db: Session, issue_id: UUID) -> BillingIssue:
    issue = db.get(BillingIssue, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return issue


def _ensure_finance_issue(issue: BillingIssue) -> None:
    if issue.context not in FINANCE_ISSUE_CONTEXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This action only applies to Finance test-review or post-live observation issues",
        )


def _record_activity(
    db: Session,
    *,
    issue_id: UUID,
    activity_type: str,
    actor_id: str,
    comment: str | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
) -> BillingIssueActivity:
    activity = BillingIssueActivity(
        billing_issue_id=issue_id,
        activity_type=activity_type,
        comment=comment,
        before_state=before_state,
        after_state=after_state,
        actor_id=actor_id,
        created_at=utc_plus_4_now(),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/", response_model=list[BillingIssueRead])
def list_issues(
    billing_cycle_id: UUID,
    context: str | None = None,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(ALL_ROLES)),
):
    query = select(BillingIssue).where(BillingIssue.billing_cycle_id == billing_cycle_id)
    if context:
        query = query.where(BillingIssue.context == context)
    return list(db.scalars(query.order_by(BillingIssue.created_at.desc())))


@router.get("/classifications", response_model=list[BillingIssueClassificationRead])
def list_classifications(
    context: str = "finance_review",
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(ALL_ROLES)),
):
    return list(
        db.scalars(
            select(BillingIssueClassification)
            .where(BillingIssueClassification.context == context, BillingIssueClassification.is_active.is_(True))
            .order_by(BillingIssueClassification.sort_order)
        )
    )


@router.get("/{issue_id}", response_model=BillingIssueRead)
def get_issue(
    issue_id: UUID,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(ALL_ROLES)),
):
    return _get_issue_or_404(db, issue_id)


@router.get("/{issue_id}/activities", response_model=list[BillingIssueActivityRead])
def list_issue_activities(
    issue_id: UUID,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(ALL_ROLES)),
):
    _get_issue_or_404(db, issue_id)
    return list(
        db.scalars(
            select(BillingIssueActivity)
            .where(BillingIssueActivity.billing_issue_id == issue_id)
            .order_by(BillingIssueActivity.created_at)
        )
    )


@router.post("/", response_model=BillingIssueRead, status_code=status.HTTP_201_CREATED)
def create_issue(
    payload: BillingIssueCreate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(get_current_actor),
):
    role = normalize_role(actor.role)
    if payload.context == "execution_issue":
        if role not in {"billing_user", "system_admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only Billing/Admin may create execution issues"
            )
        if not payload.related_script_run_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Execution issues require a related script run"
            )
    else:
        if role not in {"finance_user", "system_admin"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only Finance/Admin may create this issue type"
            )

    cycle = db.get(BillingCycle, payload.billing_cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing cycle not found")

    if payload.related_script_run_id and not db.get(ScriptRun, payload.related_script_run_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related script run not found")

    classification = db.get(BillingIssueClassification, payload.classification_id)
    expected_classification_context = "execution_issue" if payload.context == "execution_issue" else "finance_review"
    if (
        not classification
        or not classification.is_active
        or classification.context != expected_classification_context
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown or inactive classification")
    if classification.name == "Other" and not payload.detail.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="detail is required for the Other classification"
        )

    issue = BillingIssue(
        billing_cycle_id=payload.billing_cycle_id,
        context=payload.context,
        related_script_run_id=payload.related_script_run_id,
        classification_id=payload.classification_id,
        title=payload.title,
        detail=payload.detail,
        status="open",
        created_by=actor.id,
        created_at=utc_plus_4_now(),
        updated_at=utc_plus_4_now(),
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    _record_activity(
        db,
        issue_id=issue.id,
        activity_type="created",
        actor_id=actor.id,
        after_state={"title": issue.title, "context": issue.context, "status": issue.status},
    )
    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "issue_created",
        "billing_issue",
        str(issue.id),
        {"context": issue.context, "billing_cycle_id": str(issue.billing_cycle_id)},
    )
    return issue


@router.post("/{issue_id}/activities", response_model=BillingIssueActivityRead, status_code=status.HTTP_201_CREATED)
def add_issue_comment(
    issue_id: UUID,
    payload: BillingIssueCommentCreate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(FINANCE_ROLES)),
):
    issue = _get_issue_or_404(db, issue_id)
    _ensure_finance_issue(issue)

    activity = _record_activity(
        db, issue_id=issue.id, activity_type="comment", actor_id=actor.id, comment=payload.comment
    )
    record_audit_event(db, actor.id, actor.actor_type, "issue_comment_added", "billing_issue", str(issue.id), {})
    return activity


@router.patch("/{issue_id}", response_model=BillingIssueRead)
def edit_issue(
    issue_id: UUID,
    payload: BillingIssueEditRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(FINANCE_ROLES)),
):
    issue = _get_issue_or_404(db, issue_id)
    _ensure_finance_issue(issue)

    before_state = {
        "title": issue.title,
        "detail": issue.detail,
        "classification_id": str(issue.classification_id),
    }

    if payload.classification_id is not None:
        classification = db.get(BillingIssueClassification, payload.classification_id)
        if not classification or not classification.is_active or classification.context != "finance_review":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown or inactive classification")
        issue.classification_id = payload.classification_id
    if payload.title is not None:
        issue.title = payload.title
    if payload.detail is not None:
        issue.detail = payload.detail
    issue.updated_at = utc_plus_4_now()

    after_state = {
        "title": issue.title,
        "detail": issue.detail,
        "classification_id": str(issue.classification_id),
    }

    db.commit()
    db.refresh(issue)

    _record_activity(
        db,
        issue_id=issue.id,
        activity_type="edited",
        actor_id=actor.id,
        comment=payload.comment,
        before_state=before_state,
        after_state=after_state,
    )
    record_audit_event(db, actor.id, actor.actor_type, "issue_edited", "billing_issue", str(issue.id), {})
    return issue


@router.post("/{issue_id}/complete", response_model=BillingIssueRead)
def complete_issue(
    issue_id: UUID,
    payload: BillingIssueCompletionRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(FINANCE_ROLES)),
):
    issue = _get_issue_or_404(db, issue_id)
    _ensure_finance_issue(issue)
    if issue.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only open issues can be completed")

    issue.status = "completed"
    issue.completion_outcome = payload.outcome
    issue.completed_by = actor.id
    issue.completed_at = utc_plus_4_now()
    issue.completion_comment = payload.comment
    issue.updated_at = utc_plus_4_now()
    db.commit()
    db.refresh(issue)

    _record_activity(
        db,
        issue_id=issue.id,
        activity_type="completed",
        actor_id=actor.id,
        comment=payload.comment,
        after_state={"status": issue.status, "completion_outcome": issue.completion_outcome},
    )
    action = "issue_raised_in_error" if payload.outcome == "raised_in_error" else "issue_completed"
    record_audit_event(
        db, actor.id, actor.actor_type, action, "billing_issue", str(issue.id), {"outcome": payload.outcome}
    )
    return issue


@router.post("/{issue_id}/reopen", response_model=BillingIssueRead)
def reopen_issue(
    issue_id: UUID,
    payload: BillingIssueReopenRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(FINANCE_ROLES)),
):
    issue = _get_issue_or_404(db, issue_id)
    if issue.context != "finance_test_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only Finance test-review issues can be reopened"
        )
    if issue.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed issues can be reopened")

    move_to_live_approved = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == issue.billing_cycle_id,
            Approval.stage == "test",
            Approval.status == "approved",
        )
    )
    if move_to_live_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reopen after Move to Live has been approved"
        )

    before_state = {"status": issue.status, "completion_outcome": issue.completion_outcome}
    issue.status = "open"
    issue.completion_outcome = None
    issue.completed_by = None
    issue.completed_at = None
    issue.completion_comment = None
    issue.updated_at = utc_plus_4_now()
    db.commit()
    db.refresh(issue)

    _record_activity(
        db,
        issue_id=issue.id,
        activity_type="reopened",
        actor_id=actor.id,
        comment=payload.comment,
        before_state=before_state,
        after_state={"status": "open"},
    )
    record_audit_event(db, actor.id, actor.actor_type, "issue_reopened", "billing_issue", str(issue.id), {})
    return issue
