import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.billing_cycle import BillingCycle
from app.models.billing_issue import BillingIssue, BillingIssueClassification
from app.models.user import User
from app.utils.datetime_utils import utc_plus_4_now


def _make_cycle_and_user(db_session):
    user = User(
        id=uuid.uuid4(),
        name="Test Finance",
        username=f"finance-{uuid.uuid4().hex[:8]}",
        email=f"finance-{uuid.uuid4().hex[:8]}@example.com",
        role="finance",
        is_active=True,
        password_hash="x",
    )
    db_session.add(user)
    db_session.commit()

    cycle = BillingCycle(
        id=uuid.uuid4(),
        usage_month="2026-06",
        billing_month="2026-07",
        status="draft",
        created_by=user.id,
    )
    db_session.add(cycle)
    db_session.commit()
    return cycle, user


def _finance_classification(db_session, name="Loyalty Points"):
    return db_session.scalar(
        select(BillingIssueClassification).where(
            BillingIssueClassification.context == "finance_review",
            BillingIssueClassification.name == name,
        )
    )


def test_finance_classifications_seeded_by_migration(db_session):
    classifications = list(
        db_session.scalars(
            select(BillingIssueClassification).where(BillingIssueClassification.context == "finance_review")
        )
    )
    names = {c.name for c in classifications}
    assert names == {"Loyalty Points", "Bill with Zero or Negative Value", "Incorrect Product Setup", "Other"}
    assert all(c.is_active for c in classifications)


def test_open_issue_can_be_created_without_completion_fields(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="finance_test_review",
        classification_id=classification.id,
        title="Loyalty points look wrong",
        detail="Customer 1234 loyalty points not applied to the test bill.",
        status="open",
        created_by=user.id,
    )
    db_session.add(issue)
    db_session.commit()

    assert issue.status == "open"
    assert issue.completion_outcome is None


def test_completed_issue_requires_outcome_actor_and_time(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="finance_test_review",
        classification_id=classification.id,
        title="Missing completion fields",
        detail="Status completed but no outcome/actor/time set.",
        status="completed",  # violates the CHECK constraint deliberately
        created_by=user.id,
    )
    db_session.add(issue)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_raised_in_error_requires_completion_comment(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="finance_test_review",
        classification_id=classification.id,
        title="Raised in error without a comment",
        detail="This should fail the CHECK constraint.",
        status="completed",
        completion_outcome="raised_in_error",
        completed_by=user.id,
        completed_at=utc_plus_4_now(),
        completion_comment=None,
        created_by=user.id,
    )
    db_session.add(issue)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_resolved_completion_does_not_require_a_comment(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="finance_test_review",
        classification_id=classification.id,
        title="Resolved without a comment",
        detail="Resolved outcomes do not require completion_comment.",
        status="completed",
        completion_outcome="resolved",
        completed_by=user.id,
        completed_at=utc_plus_4_now(),
        completion_comment=None,
        created_by=user.id,
    )
    db_session.add(issue)
    db_session.commit()

    assert issue.completion_outcome == "resolved"
    assert issue.completion_comment is None


def test_raised_in_error_with_comment_succeeds(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="finance_test_review",
        classification_id=classification.id,
        title="Raised in error with a comment",
        detail="This finding was a duplicate.",
        status="completed",
        completion_outcome="raised_in_error",
        completed_by=user.id,
        completed_at=utc_plus_4_now(),
        completion_comment="Duplicate of another finding, no action needed.",
        created_by=user.id,
    )
    db_session.add(issue)
    db_session.commit()

    assert issue.completion_outcome == "raised_in_error"
    assert issue.completion_comment


def test_invalid_context_is_rejected(db_session):
    cycle, user = _make_cycle_and_user(db_session)
    classification = _finance_classification(db_session)

    issue = BillingIssue(
        id=uuid.uuid4(),
        billing_cycle_id=cycle.id,
        context="not_a_real_context",
        classification_id=classification.id,
        title="Bad context",
        detail="Should be rejected by the CHECK constraint.",
        status="open",
        created_by=user.id,
    )
    db_session.add(issue)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_classification_deactivation_is_not_deletion(db_session):
    classification = _finance_classification(db_session, name="Other")
    classification.is_active = False
    db_session.commit()

    still_present = db_session.get(BillingIssueClassification, classification.id)
    assert still_present is not None
    assert still_present.is_active is False
