from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.approval import Approval
from app.models.billing_cycle import BillingCycle
from app.schemas.approvals import ApprovalRead, ApprovalRequest, ApprovalRequestCreate
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role
from app.services.workflow_service import ensure_stage_runs_executed
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[ApprovalRead])
def list_approvals(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})),
):
    return list(db.scalars(select(Approval).order_by(Approval.created_at.desc())))


@router.post("/", response_model=ApprovalRead)
def create_or_update_approval(
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "finance"})),
):
    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == payload.billing_cycle_id,
            Approval.stage == payload.stage,
        )
    )

    if approval:
        approval.status = payload.status
        approval.comments = payload.comments
        approval.approved_by = actor.id
        approval.approved_at = utc_plus_4_now()
        approval.updated_at = utc_plus_4_now()
    else:
        approval = Approval(
            billing_cycle_id=payload.billing_cycle_id,
            stage=payload.stage,
            status=payload.status,
            comments=payload.comments,
            approved_by=actor.id,
            approved_at=utc_plus_4_now(),
            created_at=utc_plus_4_now(),
            updated_at=utc_plus_4_now(),
        )
        db.add(approval)

    cycle = db.get(BillingCycle, payload.billing_cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing cycle not found")

    if payload.stage == "test" and payload.status == "approved":
        cycle.status = "test_approved"
    if payload.stage == "live" and payload.status == "approved":
        cycle.status = "live_approved"
    if payload.stage == "post_live" and payload.status == "approved":
        cycle.status = "post_live_approved"

    cycle.updated_at = utc_plus_4_now()

    db.commit()
    db.refresh(approval)
    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "approval_update",
        "approval",
        str(approval.id),
        {"stage": payload.stage, "status": payload.status},
    )
    return approval


@router.post("/request", response_model=ApprovalRead)
def request_approval(
    payload: ApprovalRequestCreate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
):
    stage = payload.stage
    stage_rules = {
        "test": {"environment": "test", "script_types": ["preparation", "printing"]},
        "live": {"environment": "live", "script_types": ["preparation", "printing"]},
        "post_live": {"environment": "live", "script_types": ["preparation", "printing"]},
    }
    rule = stage_rules.get(stage)
    if not rule:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid approval stage")

    ensure_stage_runs_executed(
        db,
        billing_cycle_id=payload.billing_cycle_id,
        environment=rule["environment"],
        script_types=rule["script_types"],
    )

    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == payload.billing_cycle_id,
            Approval.stage == payload.stage,
        )
    )

    if approval:
        approval.status = "pending"
        approval.comments = payload.comments
        approval.approved_by = None
        approval.approved_at = None
        approval.updated_at = utc_plus_4_now()
    else:
        approval = Approval(
            billing_cycle_id=payload.billing_cycle_id,
            stage=payload.stage,
            status="pending",
            comments=payload.comments,
            created_at=utc_plus_4_now(),
            updated_at=utc_plus_4_now(),
        )
        db.add(approval)

    db.commit()
    db.refresh(approval)
    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "approval_requested",
        "approval",
        str(approval.id),
        {"stage": payload.stage, "status": "pending"},
    )
    return approval
