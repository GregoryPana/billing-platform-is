from datetime import datetime
from uuid import UUID

from typing import Literal

from app.schemas.base import BaseSchema


class RunUpdateRequest(BaseSchema):
    script_run_id: str
    status: Literal["planned", "executed", "failed"]
    notes: str | None = None


class RunCreateRequest(BaseSchema):
    script_definition_id: str
    status: Literal["planned", "executed", "failed"] = "planned"
    notes: str | None = None


class ScriptRunRead(BaseSchema):
    id: UUID
    script_definition_id: UUID
    status: str
    run_timestamp: datetime | None = None
    run_by: UUID | None = None
    notes: str | None = None
    created_at: datetime
