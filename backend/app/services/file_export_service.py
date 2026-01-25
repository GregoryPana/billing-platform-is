from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.generated_file import GeneratedFile
from app.models.script_definition import ScriptDefinition
from app.utils.datetime_utils import utc_plus_4_now


EXPORT_DIR = Path("backend/exports")


def create_grouped_export(
    db: Session,
    billing_cycle_id: str,
    environment: str,
    script_type: str,
    generated_by: str,
):
    definitions = list(
        db.scalars(
            select(ScriptDefinition).where(
                ScriptDefinition.billing_cycle_id == billing_cycle_id,
                ScriptDefinition.environment == environment,
                ScriptDefinition.script_type == script_type,
            )
        )
    )

    if not definitions:
        return None

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = utc_plus_4_now().strftime("%d%m%Y")
    script_label = "Prep" if script_type == "preparation" else "Print"
    file_name = f"{environment}_bill_{script_label}_{timestamp}.log"
    file_path = EXPORT_DIR / file_name

    header = f"--------{environment.upper()} {script_type.upper()}------"
    content = "\n".join([header, *[definition.command_text for definition in definitions]])
    file_path.write_text(content, encoding="utf-8")

    generated_file = GeneratedFile(
        billing_cycle_id=billing_cycle_id,
        environment=environment,
        script_type=script_type,
        file_name=file_name,
        file_path=str(file_path),
        generated_by=generated_by,
        generated_at=utc_plus_4_now(),
    )
    db.add(generated_file)
    db.commit()
    db.refresh(generated_file)
    return generated_file


def create_full_export(
    db: Session,
    billing_cycle_id: str,
    generated_by: str,
):
    definitions = list(
        db.scalars(
            select(ScriptDefinition)
            .where(ScriptDefinition.billing_cycle_id == billing_cycle_id)
            .order_by(
                ScriptDefinition.environment,
                ScriptDefinition.script_type,
                ScriptDefinition.log_type,
            )
        )
    )

    if not definitions:
        return None

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = utc_plus_4_now().strftime("%d%m%Y")
    file_name = f"all_bill_All_{timestamp}.log"
    file_path = EXPORT_DIR / file_name

    content_lines: list[str] = []
    current_group: tuple[str, str] | None = None
    for definition in definitions:
        group = (definition.environment.upper(), definition.script_type.upper())
        if group != current_group:
            content_lines.append(f"--------{group[0]} {group[1]}------")
            current_group = group
        content_lines.append(definition.command_text)
    content = "\n".join(content_lines)
    file_path.write_text(content, encoding="utf-8")

    generated_file = GeneratedFile(
        billing_cycle_id=billing_cycle_id,
        environment="all",
        script_type="all",
        file_name=file_name,
        file_path=str(file_path),
        generated_by=generated_by,
        generated_at=utc_plus_4_now(),
    )
    db.add(generated_file)
    db.commit()
    db.refresh(generated_file)
    return generated_file
