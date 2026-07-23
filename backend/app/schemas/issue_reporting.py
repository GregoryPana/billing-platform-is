from typing import Any
from uuid import UUID

from app.schemas.base import BaseSchema


class ReportingFilters(BaseSchema):
    billing_cycle_id: UUID | None = None
    start_month: str | None = None
    end_month: str | None = None


class MetricEnvelope(BaseSchema):
    source: str
    filter_scope: str
    decision_supported: str
    is_empty: bool
    data: Any


class IssueReportingSummary(BaseSchema):
    filters: ReportingFilters
    metrics: dict[str, MetricEnvelope]
