from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notifications import NotificationRead, NotificationRequest
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role
from app.services.notification_service import build_notification_command
from app.services.workflow_service import ensure_post_live_approved
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})),
):
    return list(db.scalars(select(Notification).order_by(Notification.created_at.desc())))


@router.post("/", response_model=NotificationRead)
def create_notification(
    payload: NotificationRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
):
    ensure_post_live_approved(db, payload.billing_cycle_id)

    try:
        command_text = build_notification_command(payload.billing_cycle_id, payload.notification_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid notification date") from exc

    notification = Notification(
        billing_cycle_id=payload.billing_cycle_id,
        channel="backend",
        recipient="customer-notifications",
        subject="Billing notifications command",
        message=command_text,
        status="ready",
        created_at=utc_plus_4_now(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "notification_command_generated",
        "notification",
        str(notification.id),
        {"command": command_text, "status": notification.status},
    )
    return notification
