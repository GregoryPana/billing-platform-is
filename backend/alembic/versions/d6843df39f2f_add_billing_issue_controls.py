"""add_billing_issue_controls

Revision ID: d6843df39f2f
Revises: cd4f477b7e33
Create Date: 2026-07-21 10:19:10.875793

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd6843df39f2f'
down_revision: Union[str, None] = 'cd4f477b7e33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Seed data: the initial controlled Finance classification list from
# docs/FINANCE_ISSUE_CONTROL_DESIGN.md section 4, shared by finance_test_review
# and post_live_observation issues (context="finance_review"). No execution_issue
# classifications are seeded yet - that operational list is "to be agreed during
# implementation" per the design doc.
FINANCE_CLASSIFICATIONS = [
    "Loyalty Points",
    "Bill with Zero or Negative Value",
    "Incorrect Product Setup",
    "Other",
]

billing_issue_classifications = sa.table(
    "billing_issue_classifications",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("context", sa.String),
    sa.column("name", sa.String),
    sa.column("sort_order", sa.Integer),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    now = sa.text("now()")

    op.create_table(
        "billing_issue_classifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("context", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.CheckConstraint(
            "context IN ('finance_review', 'execution_issue')",
            name="ck_billing_issue_classifications_context",
        ),
        sa.UniqueConstraint("context", "name", name="uq_billing_issue_classifications_context_name"),
    )

    op.create_table(
        "billing_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("billing_cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("billing_cycles.id"), nullable=False),
        sa.Column("context", sa.String(length=30), nullable=False),
        sa.Column("related_script_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("script_runs.id")),
        sa.Column(
            "classification_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("billing_issue_classifications.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("completion_outcome", sa.String(length=20)),
        sa.Column("completed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("completion_comment", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.CheckConstraint(
            "context IN ('execution_issue', 'finance_test_review', 'post_live_observation')",
            name="ck_billing_issues_context",
        ),
        sa.CheckConstraint("status IN ('open', 'completed')", name="ck_billing_issues_status"),
        sa.CheckConstraint(
            "completion_outcome IS NULL OR completion_outcome IN ('resolved', 'raised_in_error')",
            name="ck_billing_issues_completion_outcome",
        ),
        sa.CheckConstraint(
            "(status = 'open' AND completion_outcome IS NULL AND completed_by IS NULL AND completed_at IS NULL) "
            "OR (status = 'completed' AND completion_outcome IS NOT NULL AND completed_by IS NOT NULL "
            "AND completed_at IS NOT NULL)",
            name="ck_billing_issues_completion_requires_outcome_actor_time",
        ),
        sa.CheckConstraint(
            "completion_outcome IS DISTINCT FROM 'raised_in_error' OR completion_comment IS NOT NULL",
            name="ck_billing_issues_raised_in_error_requires_comment",
        ),
    )

    op.create_table(
        "billing_issue_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("billing_issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("billing_issues.id"), nullable=False),
        sa.Column("activity_type", sa.String(length=30), nullable=False),
        sa.Column("comment", sa.Text()),
        sa.Column("before_state", postgresql.JSONB()),
        sa.Column("after_state", postgresql.JSONB()),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.CheckConstraint(
            "activity_type IN ('created', 'comment', 'edited', 'completed', 'reopened')",
            name="ck_billing_issue_activities_activity_type",
        ),
    )

    op.bulk_insert(
        billing_issue_classifications,
        [
            {
                "id": uuid.uuid4(),
                "context": "finance_review",
                "name": name,
                "sort_order": index,
                "is_active": True,
            }
            for index, name in enumerate(FINANCE_CLASSIFICATIONS)
        ],
    )


def downgrade() -> None:
    op.drop_table("billing_issue_activities")
    op.drop_table("billing_issues")
    op.drop_table("billing_issue_classifications")
