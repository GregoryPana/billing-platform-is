from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.approval import Approval
from app.models.script_definition import ScriptDefinition
from app.models.script_run import ScriptRun


def ensure_test_approved(db: Session, billing_cycle_id: str) -> None:
    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == billing_cycle_id,
            Approval.stage == "test",
            Approval.status == "approved",
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test approval is required before live actions.",
        )


def ensure_post_live_approved(db: Session, billing_cycle_id: str) -> None:
    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == billing_cycle_id,
            Approval.stage == "post_live",
            Approval.status == "approved",
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post-live approval is required before notifications.",
        )


def ensure_stage_runs_executed(
    db: Session,
    billing_cycle_id: str,
    environment: str,
    script_types: list[str],
) -> None:
    total_scripts = db.scalar(
        select(func.count())
        .select_from(ScriptDefinition)
        .where(
            ScriptDefinition.billing_cycle_id == billing_cycle_id,
            ScriptDefinition.environment == environment,
            ScriptDefinition.script_type.in_(script_types),
        )
    )
    if not total_scripts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate scripts before requesting approval.",
        )

    executed_scripts = db.scalar(
        select(func.count())
        .select_from(ScriptRun)
        .join(ScriptDefinition, ScriptRun.script_definition_id == ScriptDefinition.id)
        .where(
            ScriptDefinition.billing_cycle_id == billing_cycle_id,
            ScriptDefinition.environment == environment,
            ScriptDefinition.script_type.in_(script_types),
            ScriptRun.status == "executed",
        )
    )
    if executed_scripts < total_scripts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All scripts must be executed before requesting approval.",
        )
