from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class ScriptGenerateRequest(BaseSchema):
    billing_cycle_id: str
    environment: str
    script_type: str
    log_types: list[str]
    overrides: dict[str, str] | None = None


class ScriptDefinitionRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    environment: str
    script_type: str
    log_type: str
    parameters: dict[str, str] = Field(default_factory=dict)
    command_text: str
    created_by: UUID
    created_at: datetime
