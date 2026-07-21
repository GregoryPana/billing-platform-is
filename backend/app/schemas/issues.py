from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from app.models.billing_issue import COMPLETION_OUTCOMES, ISSUE_CONTEXTS
from app.schemas.base import BaseSchema


class BillingIssueClassificationRead(BaseSchema):
    id: UUID
    context: str
    name: str
    sort_order: int
    is_active: bool


class BillingIssueCreate(BaseSchema):
    billing_cycle_id: UUID
    context: str
    related_script_run_id: UUID | None = None
    classification_id: UUID
    title: str = Field(min_length=1, max_length=255)
    # "Other" classifications additionally require a real explanation, not just
    # a non-empty string - the classification-name cross-check (Other -> detail)
    # happens in the route/service layer (Task 3), where the classification row
    # can be looked up; this schema enforces the baseline "detail is required"
    # rule that applies to every issue regardless of classification.
    detail: str = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_context(self) -> "BillingIssueCreate":
        if self.context not in ISSUE_CONTEXTS:
            raise ValueError(f"context must be one of {ISSUE_CONTEXTS}")
        return self


class BillingIssueRead(BaseSchema):
    id: UUID
    billing_cycle_id: UUID
    context: str
    related_script_run_id: UUID | None = None
    classification_id: UUID
    title: str
    detail: str
    status: str
    completion_outcome: str | None = None
    completed_by: UUID | None = None
    completed_at: datetime | None = None
    completion_comment: str | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class BillingIssueCompletionRequest(BaseSchema):
    outcome: str
    comment: str | None = None

    @model_validator(mode="after")
    def _validate_outcome_and_comment(self) -> "BillingIssueCompletionRequest":
        if self.outcome not in COMPLETION_OUTCOMES:
            raise ValueError(f"outcome must be one of {COMPLETION_OUTCOMES}")
        if self.outcome == "raised_in_error" and not (self.comment and self.comment.strip()):
            raise ValueError("comment is required when outcome is raised_in_error")
        return self


class BillingIssueReopenRequest(BaseSchema):
    comment: str = Field(min_length=1)


class BillingIssueActivityRead(BaseSchema):
    id: UUID
    billing_issue_id: UUID
    activity_type: str
    comment: str | None = None
    before_state: dict[str, Any] | None = None
    after_state: dict[str, Any] | None = None
    actor_id: UUID
    created_at: datetime
