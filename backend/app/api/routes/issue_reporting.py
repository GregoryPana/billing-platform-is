from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.issue_reporting import IssueReportingSummary
from app.services.auth_service import CurrentActor, require_role, role_set
from app.services.issue_reporting_service import build_issue_reporting_summary


router = APIRouter()

FINANCE_ROLES = role_set("system_admin", "finance_user")


@router.get("/summary", response_model=IssueReportingSummary)
def get_issue_reporting_summary(
    billing_cycle_id: UUID | None = None,
    start_month: str | None = None,
    end_month: str | None = None,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(FINANCE_ROLES)),
):
    return build_issue_reporting_summary(
        db, billing_cycle_id=billing_cycle_id, start_month=start_month, end_month=end_month
    )
