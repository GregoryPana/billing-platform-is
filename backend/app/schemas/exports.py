from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class ScriptExportRequest(BaseSchema):
    billing_cycle_id: str
    environment: str
    script_type: str


class ScriptExportAllRequest(BaseSchema):
    billing_cycle_id: str


class ScriptExportRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    environment: str
    script_type: str
    file_name: str
    file_path: str
    generated_by: UUID | None = None
    generated_at: datetime
