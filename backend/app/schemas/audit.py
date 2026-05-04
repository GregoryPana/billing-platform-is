from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class AuditLogRead(BaseSchema):
    id: UUID
    actor_id: UUID | None = None
    actor_type: str
    action: str
    entity_type: str
    entity_id: UUID | None = None
    metadata_json: dict
    created_at: datetime
