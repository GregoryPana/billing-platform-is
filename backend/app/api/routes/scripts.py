from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.generated_file import GeneratedFile
from app.models.script_definition import ScriptDefinition
from app.models.script_run import ScriptRun
from app.schemas.exports import ScriptExportRead, ScriptExportRequest
from app.schemas.scripts import ScriptDefinitionRead, ScriptGenerateRequest
from app.services.audit_service import record_audit_event
from app.services.auth_service import CurrentActor, require_role
from app.services.command_service import CYCLES, format_command, generate_parameters
from app.services.file_export_service import create_grouped_export
from app.services.workflow_service import ensure_test_approved
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


@router.get("/", response_model=list[ScriptDefinitionRead])
def list_scripts(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})),
):
    return list(db.scalars(select(ScriptDefinition).order_by(ScriptDefinition.created_at.desc())))


@router.post("/generate", response_model=list[ScriptDefinitionRead])
def generate_scripts(
    payload: ScriptGenerateRequest,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
):
    if payload.environment.lower() == "live":
        ensure_test_approved(db, payload.billing_cycle_id)

    existing_definitions = list(
        db.scalars(
            select(ScriptDefinition).where(
                ScriptDefinition.billing_cycle_id == payload.billing_cycle_id,
                ScriptDefinition.environment == payload.environment.lower(),
                ScriptDefinition.script_type == payload.script_type.lower(),
            )
        )
    )
    if existing_definitions:
        existing_ids = [definition.id for definition in existing_definitions]
        db.query(ScriptRun).filter(ScriptRun.script_definition_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        db.query(ScriptDefinition).filter(ScriptDefinition.id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        db.query(GeneratedFile).filter(
            GeneratedFile.billing_cycle_id == payload.billing_cycle_id,
            GeneratedFile.environment == payload.environment.lower(),
            GeneratedFile.script_type == payload.script_type.lower(),
        ).delete(synchronize_session=False)
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
    actor: CurrentActor = Depends(require_role({"admin", "billing"})),
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
