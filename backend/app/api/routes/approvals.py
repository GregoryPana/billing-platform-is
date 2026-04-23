from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.approval import Approval
from app.models.approval_request_settings import ApprovalRequestSettings
from app.models.billing_cycle import BillingCycle
from app.models.user import User
from app.schemas.approvals import ApprovalRead, ApprovalRequest, ApprovalRequestCreate
from app.schemas.approval_settings import ApprovalSettingsRead, ApprovalSettingsUpdate
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role
from app.services.workflow_service import ensure_stage_runs_executed
from app.utils.datetime_utils import utc_plus_4_now
from app.config import settings


router = APIRouter()


def _get_or_create_settings(db: Session) -> ApprovalRequestSettings:
    settings_record = db.scalar(select(ApprovalRequestSettings))
    if settings_record:
        return settings_record
    settings_record = ApprovalRequestSettings()
    db.add(settings_record)
    db.commit()
    db.refresh(settings_record)
    return settings_record


def _format_month_label(value: str | None) -> str:
    if not value:
        return "-"
    try:
        year_str, month_str = value.split("-")
        year = int(year_str)
        month = int(month_str)
    except (ValueError, AttributeError):
        return value
    if not year or not month:
        return value
    date = datetime(year, month, 1, tzinfo=timezone.utc)
    return date.strftime("%b %Y")


def _format_cycle_label(cycle: BillingCycle | None) -> str:
    if not cycle:
        return "-"
    return f"{_format_month_label(cycle.usage_month)} - {_format_month_label(cycle.billing_month)}"


@router.get("/", response_model=list[ApprovalRead])
def list_approvals(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})),
):
    return list(db.scalars(select(Approval).order_by(Approval.created_at.desc())))


@router.get("/settings", response_model=ApprovalSettingsRead)
def get_approval_settings(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
):
    settings_record = _get_or_create_settings(db)
    return ApprovalSettingsRead(
        billing_email=settings_record.billing_email,
        default_message=settings_record.default_message,
        finance_recipients=settings_record.finance_recipients or [],
    )


@router.put("/settings", response_model=ApprovalSettingsRead)
def update_approval_settings(
    payload: ApprovalSettingsUpdate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
):
    settings_record = _get_or_create_settings(db)
    if payload.billing_email is not None:
        settings_record.billing_email = payload.billing_email
    if payload.default_message is not None:
        settings_record.default_message = payload.default_message
    if payload.finance_recipients is not None:
        settings_record.finance_recipients = payload.finance_recipients
    settings_record.updated_at = utc_plus_4_now()
    db.commit()
    db.refresh(settings_record)
    return ApprovalSettingsRead(
        billing_email=settings_record.billing_email,
        default_message=settings_record.default_message,
        finance_recipients=settings_record.finance_recipients or [],
    )


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

    if actor.role == "finance":
        if not approval or approval.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approval must be requested before review.",
            )

    cycle = db.get(BillingCycle, payload.billing_cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing cycle not found")

    if actor.role == "finance" and payload.status == "approved":
        if not settings.n8n_approval_webhook_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approval webhook URL not configured",
            )
        try:
            settings_record = _get_or_create_settings(db)
            finance_user = db.get(User, actor.id)
            requester_label = (
                "Request to Send Billing Notifications"
                if payload.stage == "post_live"
                else "Request to Move to Live Billing"
            )
            webhook_payload = {
                "body": {
                    "finance_email": finance_user.email if finance_user else "",
                    "finance_name": finance_user.name if finance_user else "",
                    "billing_email": settings_record.billing_email,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "cycle": _format_cycle_label(cycle),
                    "approval_request": requester_label,
                    "decision": payload.status,
                    "comment": payload.comments or "",
                }
            }
            webhook_response = requests.post(
                settings.n8n_approval_webhook_url,
                json=[webhook_payload],
                timeout=10,
                verify=settings.n8n_webhook_verify,
            )
            if not webhook_response.ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Approval webhook failed ({webhook_response.status_code})",
                )
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Approval webhook unreachable",
            ) from exc

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
    if not settings.n8n_webhook_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approval webhook URL not configured")
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

    try:
        settings_record = _get_or_create_settings(db)
        cycle = db.get(BillingCycle, payload.billing_cycle_id)
        if not cycle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing cycle not found")
        requester = db.get(User, actor.id)
        approval_label = (
            "Request to Send Billing Notifications" if payload.stage == "post_live" else "Request to Move to Live Billing"
        )
        recipients = payload.recipients if payload.recipients else (settings_record.finance_recipients or [])
        base_message = payload.comments or settings_record.default_message or ""
        app_link = payload.app_link if payload.app_link else ""
        final_message = f"{base_message}\n\nApproval Link: {app_link}".strip() if app_link else base_message

        webhook_payload = {
            "body": {
                "recipients": recipients,
                "billing_email": settings_record.billing_email,
                "requested_by": requester.name if requester else "",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cycle": _format_cycle_label(cycle),
                "approval_request": approval_label,
                "message": final_message,
                "approval_link": app_link,
            }
        }
        webhook_response = requests.post(
            settings.n8n_webhook_url,
            json=[webhook_payload],
            timeout=10,
            verify=settings.n8n_webhook_verify,
        )
        if not webhook_response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Approval webhook failed ({webhook_response.status_code})",
            )
    except requests.RequestException as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Approval webhook unreachable") from exc

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
