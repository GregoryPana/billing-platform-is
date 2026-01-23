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

    content = "\n".join(definition.command_text for definition in definitions)
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
