import uuid

from sqlalchemy import text

from app.api.routes import approvals as approvals_routes
from app.db.session import engine


class _SuccessfulWebhookResponse:
    ok = True
    status_code = 200


def _create_cycle(client, auth_headers) -> str:
    response = client.post(
        "/api/cycles/",
        json={"usage_month": "2026-10", "billing_month": "2026-11", "notes": "Synthetic Package 12 rehearsal"},
        headers=auth_headers("billing_user"),
    )
    response.raise_for_status()
    return response.json()["id"]


def _classification_id(name: str, context: str = "finance_review") -> str:
    with engine.begin() as connection:
        row = connection.execute(
            text("SELECT id FROM billing_issue_classifications WHERE context = :context AND name = :name"),
            {"context": context, "name": name},
        ).first()
    assert row is not None, f"Missing seeded classification: {context}/{name}"
    return str(row[0])


def _insert_executed_stage_runs(cycle_id: str, actor_id: str, environment: str) -> None:
    with engine.begin() as connection:
        for script_type in ("preparation", "printing"):
            definition_id = str(uuid.uuid4())
            connection.execute(
                text(
                    """
                    INSERT INTO script_definitions
                        (id, billing_cycle_id, environment, script_type, log_type,
                         parameters, command_text, created_by, created_at)
                    VALUES
                        (:id, :cycle_id, :environment, :script_type, 'daily',
                         '{}', 'echo synthetic-rehearsal', :actor_id, now())
                    """
                ),
                {
                    "id": definition_id,
                    "cycle_id": cycle_id,
                    "environment": environment,
                    "script_type": script_type,
                    "actor_id": actor_id,
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO script_runs
                        (id, script_definition_id, status, notes, created_at, run_timestamp, run_by)
                    VALUES
                        (:id, :definition_id, 'executed', 'Synthetic Package 12 rehearsal', now(), now(), :actor_id)
                    """
                ),
                {"id": str(uuid.uuid4()), "definition_id": definition_id, "actor_id": actor_id},
            )


def _request_approval(client, auth_headers, cycle_id: str, stage: str):
    return client.post(
        "/api/approvals/request",
        json={
            "billing_cycle_id": cycle_id,
            "stage": stage,
            "recipients": ["synthetic-finance@example.invalid"],
            "comments": f"Synthetic {stage} approval request",
            "app_link": "https://example.invalid/billing/",
        },
        headers=auth_headers("billing_user"),
    )


def _finance_decision(client, auth_headers, cycle_id: str, stage: str, decision: str = "approved"):
    return client.post(
        "/api/approvals/",
        json={
            "billing_cycle_id": cycle_id,
            "stage": stage,
            "status": decision,
            "comments": f"Synthetic {stage} decision",
        },
        headers=auth_headers("finance_user"),
    )


def test_rg01_full_synthetic_cycle_rehearsal(client, auth_headers, test_actor_id, monkeypatch):
    """Exercise the complete implemented cycle without real integrations or data.

    The implemented terminal state is `post_live_approved`, displayed by the UI
    as Completed. There is no separate stored `closed` state in the current
    contract, so this test does not invent one.
    """

    monkeypatch.setattr(approvals_routes.settings, "n8n_webhook_url", "https://example.invalid/request")
    monkeypatch.setattr(approvals_routes.settings, "n8n_approval_webhook_url", "https://example.invalid/decision")
    monkeypatch.setattr(
        approvals_routes.requests,
        "post",
        lambda *args, **kwargs: _SuccessfulWebhookResponse(),
    )

    # Role separation starts at cycle creation.
    forbidden_cycle = client.post(
        "/api/cycles/",
        json={"usage_month": "2026-09", "billing_month": "2026-10"},
        headers=auth_headers("finance_user"),
    )
    assert forbidden_cycle.status_code == 403

    cycle_id = _create_cycle(client, auth_headers)
    _insert_executed_stage_runs(cycle_id, test_actor_id("billing_user"), "test")

    # A Finance test-review issue blocks Move to Live until Finance completes it.
    issue = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": "finance_test_review",
            "classification_id": _classification_id("Loyalty Points"),
            "title": "Synthetic loyalty-points finding",
            "detail": "Synthetic data only; verifies the issue gate.",
        },
        headers=auth_headers("finance_user"),
    )
    issue.raise_for_status()
    issue_id = issue.json()["id"]

    blocked = client.post(
        "/api/approvals/",
        json={"billing_cycle_id": cycle_id, "stage": "test", "status": "approved", "comments": None},
        headers=auth_headers("system_admin"),
    )
    assert blocked.status_code == 400
    assert blocked.json()["detail"]["open_issue_count"] == 1

    comment = client.post(
        f"/api/issues/{issue_id}/activities",
        json={"comment": "Synthetic Finance review completed."},
        headers=auth_headers("finance_user"),
    )
    assert comment.status_code == 201
    completed = client.post(
        f"/api/issues/{issue_id}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("finance_user"),
    )
    assert completed.status_code == 200
    assert completed.json()["completed_by"]
    assert completed.json()["completed_at"]

    requested_test = _request_approval(client, auth_headers, cycle_id, "test")
    assert requested_test.status_code == 200
    assert requested_test.json()["status"] == "pending"

    billing_cannot_approve = client.post(
        "/api/approvals/",
        json={"billing_cycle_id": cycle_id, "stage": "test", "status": "approved", "comments": None},
        headers=auth_headers("billing_user"),
    )
    assert billing_cannot_approve.status_code == 403

    test_approved = _finance_decision(client, auth_headers, cycle_id, "test")
    assert test_approved.status_code == 200
    cycle = next(
        item for item in client.get("/api/cycles/", headers=auth_headers("billing_user")).json() if item["id"] == cycle_id
    )
    assert cycle["status"] == "test_approved"

    _insert_executed_stage_runs(cycle_id, test_actor_id("billing_user"), "live")

    observation = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": "post_live_observation",
            "classification_id": _classification_id("Incorrect Product Setup"),
            "title": "Synthetic post-live observation",
            "detail": "Synthetic observation for Package 12 rehearsal.",
        },
        headers=auth_headers("finance_user"),
    )
    assert observation.status_code == 201
    billing_observation = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": "post_live_observation",
            "classification_id": _classification_id("Incorrect Product Setup"),
            "title": "Forbidden observation",
            "detail": "Billing must not create this context.",
        },
        headers=auth_headers("billing_user"),
    )
    assert billing_observation.status_code == 403

    requested_post_live = _request_approval(client, auth_headers, cycle_id, "post_live")
    assert requested_post_live.status_code == 200
    post_live_approved = _finance_decision(client, auth_headers, cycle_id, "post_live")
    assert post_live_approved.status_code == 200

    notification = client.post(
        "/api/notifications/",
        json={"billing_cycle_id": cycle_id, "notification_date": "2026-11-15"},
        headers=auth_headers("billing_user"),
    )
    assert notification.status_code == 200
    assert notification.json()["status"] == "ready"
    finance_notification = client.post(
        "/api/notifications/",
        json={"billing_cycle_id": cycle_id, "notification_date": "2026-11-15"},
        headers=auth_headers("finance_user"),
    )
    assert finance_notification.status_code == 403

    final_cycle = next(
        item for item in client.get("/api/cycles/", headers=auth_headers("system_admin")).json() if item["id"] == cycle_id
    )
    assert final_cycle["status"] == "post_live_approved"

    report = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    assert report.status_code == 200
    metrics = report.json()["metrics"]
    assert metrics["test_review_issues_by_cycle"]["is_empty"] is False
    assert metrics["classification_breakdown"]["is_empty"] is False
    assert metrics["test_review_vs_post_live"]["is_empty"] is False

    audit = client.get("/api/audit/", headers=auth_headers("system_admin"))
    assert audit.status_code == 200
    actions = {event["action"] for event in audit.json()}
    assert {"create_cycle", "approval_requested", "approval_update", "notification_command_generated"} <= actions
