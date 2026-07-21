from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing_cycle import BillingCycle
from app.schemas.cycles import BillingCycleCreate, BillingCycleRead, BillingCycleStatusUpdate
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role, role_set
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[BillingCycleRead])
def list_cycles(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user", "viewer"))),
):
    return list(db.scalars(select(BillingCycle).order_by(BillingCycle.created_at.desc())))


@router.post("/", response_model=BillingCycleRead)
def create_cycle(
    payload: BillingCycleCreate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    cycle = BillingCycle(
        usage_month=payload.usage_month,
        billing_month=payload.billing_month,
        status="draft",
        notes=payload.notes,
        created_by=actor.id,
        created_at=utc_plus_4_now(),
        updated_at=utc_plus_4_now(),
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    record_audit_event(db, actor.id, actor.actor_type, "create_cycle", "billing_cycle", str(cycle.id), {})
    return cycle


@router.patch("/{cycle_id}/status", response_model=BillingCycleRead)
def update_cycle_status(
    cycle_id: str,
    payload: BillingCycleStatusUpdate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user"))),
):
    cycle = db.get(BillingCycle, cycle_id)
    cycle.status = payload.status
    cycle.updated_at = utc_plus_4_now()
    db.commit()
    db.refresh(cycle)
    record_audit_event(db, actor.id, actor.actor_type, "update_cycle_status", "billing_cycle", cycle_id, {
        "status": payload.status
    })
    return cycle
