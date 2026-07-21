"""seed_execution_issue_classifications

Revision ID: 6ab1c9b21c7b
Revises: d6843df39f2f
Create Date: 2026-07-21 15:15:22.326848

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6ab1c9b21c7b'
down_revision: Union[str, None] = 'd6843df39f2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The operational classification list for Billing execution issues, per
# docs/FINANCE_ISSUE_CONTROL_DESIGN.md section 4's "to be agreed during
# implementation" list (script execution, parameters, environment/access,
# unexpected output, Other). Kept deliberately distinct from the
# context="finance_review" list so Finance bill findings and Billing run
# exceptions never share a dropdown.
EXECUTION_CLASSIFICATIONS = [
    "Script Execution Failure",
    "Parameter or Configuration Issue",
    "Environment or Access Issue",
    "Unexpected Output",
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
    op.bulk_insert(
        billing_issue_classifications,
        [
            {
                "id": uuid.uuid4(),
                "context": "execution_issue",
                "name": name,
                "sort_order": index,
                "is_active": True,
            }
            for index, name in enumerate(EXECUTION_CLASSIFICATIONS)
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text("DELETE FROM billing_issue_classifications WHERE context = 'execution_issue'")
    )
