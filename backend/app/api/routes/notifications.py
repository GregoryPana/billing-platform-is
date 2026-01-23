from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notifications import NotificationRead, NotificationRequest
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role
from app.services.notification_service import send_notification
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

    notification = Notification(
        billing_cycle_id=payload.billing_cycle_id,
        channel=payload.channel,
        recipient=payload.recipient,
        subject=payload.subject,
        message=payload.message,
        status="queued",
        created_at=utc_plus_4_now(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    success, reason = send_notification(
        payload.channel,
        payload.recipient,
        payload.subject,
        payload.message,
    )
    notification.status = "sent" if success else "failed"
    notification.sent_at = utc_plus_4_now() if success else None
    db.commit()
    db.refresh(notification)

    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "notification_queued",
        "notification",
        str(notification.id),
        {"channel": payload.channel, "recipient": payload.recipient, "status": notification.status},
    )
    return notification
