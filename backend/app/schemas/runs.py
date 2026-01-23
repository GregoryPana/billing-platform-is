from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class RunUpdateRequest(BaseSchema):
    script_run_id: str
    status: str
    notes: str | None = None


class RunCreateRequest(BaseSchema):
    script_definition_id: str
    status: str = "planned"
    notes: str | None = None


class ScriptRunRead(BaseSchema):
    id: UUID
    script_definition_id: UUID
    status: str
    run_timestamp: datetime | None = None
    run_by: UUID | None = None
    notes: str | None = None
    created_at: datetime
