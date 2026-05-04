from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.utils.datetime_utils import utc_plus_4_now


def record_audit_event(
    db: Session,
    actor_id: str | None,
    actor_type: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    metadata: dict,
):
    audit_log = AuditLog(
        actor_id=actor_id,
        actor_type=actor_type,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=metadata,
        created_at=utc_plus_4_now(),
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log
