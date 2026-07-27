from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing_cycle import BillingCycle
from app.models.generated_file import GeneratedFile
from app.models.script_definition import ScriptDefinition
from app.models.script_run import ScriptRun
from app.schemas.exports import ScriptExportAllRequest, ScriptExportRead, ScriptExportRequest
from app.schemas.scripts import ScriptDefinitionRead, ScriptGenerateRequest
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role, role_set
from app.services.command_service import CYCLES, format_command, generate_parameters
from app.services.file_export_service import EXPORT_DIR, create_full_export, create_grouped_export
from app.services.workflow_service import ensure_test_approved
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[ScriptDefinitionRead])
def list_scripts(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user"))),
):
    return list(db.scalars(select(ScriptDefinition).order_by(ScriptDefinition.created_at.desc())))


@router.post("/generate", response_model=list[ScriptDefinitionRead])
def generate_scripts(
    payload: ScriptGenerateRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    if payload.environment.lower() == "live":
        ensure_test_approved(db, payload.billing_cycle_id)

    cycle = db.get(BillingCycle, payload.billing_cycle_id)
    if not cycle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing cycle not found")

    target_definitions = select(ScriptDefinition.id).where(
        ScriptDefinition.billing_cycle_id == payload.billing_cycle_id,
        ScriptDefinition.environment == payload.environment.lower(),
        ScriptDefinition.script_type == payload.script_type.lower(),
    )
    db.execute(delete(ScriptRun).where(ScriptRun.script_definition_id.in_(target_definitions)))
    db.execute(
        delete(ScriptDefinition).where(
            ScriptDefinition.billing_cycle_id == payload.billing_cycle_id,
            ScriptDefinition.environment == payload.environment.lower(),
            ScriptDefinition.script_type == payload.script_type.lower(),
        )
    )
    db.execute(
        delete(GeneratedFile).where(
            GeneratedFile.billing_cycle_id == payload.billing_cycle_id,
            GeneratedFile.environment == payload.environment.lower(),
            GeneratedFile.script_type == payload.script_type.lower(),
        )
    )
    db.commit()

    created_scripts: list[ScriptDefinition] = []
    log_types = payload.log_types
    if "ALL" in payload.log_types:
        log_types = CYCLES

    for log_type in log_types:
        parameters = generate_parameters(
            payload.script_type,
            payload.environment,
            log_type,
            cycle.usage_month,
            payload.overrides,
        )
        command_text = format_command(payload.script_type, payload.environment, log_type, parameters)
        definition = ScriptDefinition(
            billing_cycle_id=payload.billing_cycle_id,
            environment=payload.environment.lower(),
            script_type=payload.script_type.lower(),
            log_type=log_type,
            parameters=parameters,
            command_text=command_text,
            created_by=actor.id,
            created_at=utc_plus_4_now(),
        )
        db.add(definition)
        db.flush()
        db.add(
            ScriptRun(
                script_definition_id=definition.id,
                status="planned",
                run_by=actor.id,
                created_at=utc_plus_4_now(),
            )
        )
        created_scripts.append(definition)

    db.commit()
    for definition in created_scripts:
        db.refresh(definition)
        record_audit_event(
            db,
            actor.id,
            actor.actor_type,
            "generate_script",
            "script_definition",
            str(definition.id),
            {
                "environment": definition.environment,
                "script_type": definition.script_type,
                "log_type": definition.log_type,
            },
        )

    return created_scripts


@router.post("/export", response_model=ScriptExportRead)
def export_scripts(
    payload: ScriptExportRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    environment = payload.environment.lower()
    script_type = payload.script_type.lower()
    if environment == "live":
        ensure_test_approved(db, payload.billing_cycle_id)

    generated_file = create_grouped_export(
        db,
        billing_cycle_id=payload.billing_cycle_id,
        environment=environment,
        script_type=script_type,
        generated_by=actor.id,
    )
    if not generated_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No scripts to export")

    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "export_scripts",
        "generated_file",
        str(generated_file.id),
        {"environment": environment, "script_type": script_type},
    )
    return generated_file


@router.post("/export-all", response_model=ScriptExportRead)
def export_all_scripts(
    payload: ScriptExportAllRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user"))),
):
    has_live = db.scalar(
        select(ScriptDefinition.id)
        .where(
            ScriptDefinition.billing_cycle_id == payload.billing_cycle_id,
            ScriptDefinition.environment == "live",
        )
        .limit(1)
    )
    if has_live:
        ensure_test_approved(db, payload.billing_cycle_id)

    generated_file = create_full_export(
        db,
        billing_cycle_id=payload.billing_cycle_id,
        generated_by=actor.id,
    )
    if not generated_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No scripts to export")

    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "export_scripts_all",
        "generated_file",
        str(generated_file.id),
        {"scope": "billing_cycle"},
    )
    return generated_file


@router.get("/exports/{export_id}/download")
def download_export(
    export_id: UUID,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user"))),
):
    generated_file = db.get(GeneratedFile, export_id)
    if not generated_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found")

    file_path = Path(generated_file.file_path)
    resolved_path = file_path.resolve(strict=False)
    export_root = EXPORT_DIR.resolve()
    if export_root not in resolved_path.parents and resolved_path != export_root:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid export path")
    if not resolved_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file missing")

    return FileResponse(
        path=resolved_path,
        filename=generated_file.file_name,
        media_type="text/plain",
    )
