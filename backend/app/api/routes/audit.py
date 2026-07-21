from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogRead
from app.services.auth_service import CurrentActor, require_role, role_set


router = APIRouter()


@router.get("/", response_model=list[AuditLogRead])
def list_audit_logs(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user", "viewer"))),
):
    return list(db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc())))
