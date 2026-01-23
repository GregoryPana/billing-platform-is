from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.approval import Approval


def ensure_test_approved(db: Session, billing_cycle_id: str) -> None:
    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == billing_cycle_id,
            Approval.stage == "test",
            Approval.status == "approved",
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test approval is required before live actions.",
        )


def ensure_post_live_approved(db: Session, billing_cycle_id: str) -> None:
    approval = db.scalar(
        select(Approval).where(
            Approval.billing_cycle_id == billing_cycle_id,
            Approval.stage == "post_live",
            Approval.status == "approved",
        )
    )
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post-live approval is required before notifications.",
        )
