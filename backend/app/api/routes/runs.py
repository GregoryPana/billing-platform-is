from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.script_run import ScriptRun
from app.schemas.runs import RunCreateRequest, RunUpdateRequest, ScriptRunRead
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role, role_set
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[ScriptRunRead])
def list_runs(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user", "viewer"))),
):
    return list(db.scalars(select(ScriptRun).order_by(ScriptRun.created_at.desc())))


@router.post("/", response_model=ScriptRunRead)
def create_run(
    payload: RunCreateRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    run = ScriptRun(
        script_definition_id=payload.script_definition_id,
        status=payload.status,
        notes=payload.notes,
        run_by=actor.id,
        run_timestamp=utc_plus_4_now() if payload.status == "executed" else None,
        created_at=utc_plus_4_now(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "create_run",
        "script_run",
        str(run.id),
        {"status": payload.status},
    )
    return run


@router.patch("/", response_model=ScriptRunRead)
def update_run_status(
    payload: RunUpdateRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    run = db.get(ScriptRun, payload.script_run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    run.status = payload.status
    run.notes = payload.notes
    run.run_by = actor.id
    if payload.status == "executed":
        run.run_timestamp = utc_plus_4_now()
    if payload.status != "executed":
        run.run_timestamp = None

    db.commit()
    db.refresh(run)
    record_audit_event(db, actor.id, actor.actor_type, "update_run", "script_run", payload.script_run_id, {
        "status": payload.status
    })
    return run
