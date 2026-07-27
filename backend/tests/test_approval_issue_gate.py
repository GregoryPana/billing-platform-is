import uuid

from sqlalchemy import text

from app.db.session import engine


def _create_cycle(client, auth_headers):
    response = client.post(
        "/api/cycles/",
        json={"usage_month": "2026-06", "billing_month": "2026-07"},
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
    return str(row[0])


def _create_issue(client, auth_headers, cycle_id: str, context: str = "finance_test_review") -> dict:
    response = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": context,
            "classification_id": _classification_id("Loyalty Points"),
            "title": "Loyalty points look wrong",
            "detail": "Customer 1234 loyalty points not applied to the test bill.",
        },
        headers=auth_headers("finance_user"),
    )
    response.raise_for_status()
    return response.json()


def _complete_issue(client, auth_headers, issue_id: str, outcome: str = "resolved") -> None:
    payload = {"outcome": outcome}
    if outcome == "raised_in_error":
        payload["comment"] = "Duplicate finding, no action needed."
    client.post(f"/api/issues/{issue_id}/complete", json=payload, headers=auth_headers("finance_user")).raise_for_status()


def _insert_pending_test_approval(cycle_id: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO approvals (id, billing_cycle_id, stage, status, created_at, updated_at)
                VALUES (:id, :billing_cycle_id, 'test', 'pending', now(), now())
                """
            ),
            {"id": str(uuid.uuid4()), "billing_cycle_id": cycle_id},
        )


def _approve_stage_test(client, auth_headers, role: str, cycle_id: str, status: str = "approved"):
    return client.post(
        "/api/approvals/",
        json={"billing_cycle_id": cycle_id, "stage": "test", "status": status, "comments": None},
        headers=auth_headers(role),
    )


def test_admin_approval_blocked_by_open_finance_test_review_issue(client, auth_headers):
    # Uses system_admin (not finance_user) so the request never reaches the
    # approval webhook branch, which would otherwise call a real n8n webhook
    # configured in this environment's .env.local.
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 400
    assert response.json()["detail"]["open_issue_count"] == 1


def test_admin_approval_blocked_reports_correct_open_count(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)
    _create_issue(client, auth_headers, cycle_id)

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 400
    assert response.json()["detail"]["open_issue_count"] == 2


def test_finance_approval_blocked_by_open_issue_before_reaching_webhook(client, auth_headers):
    # finance_user approval normally requires the approval webhook, which is
    # deliberately not exercised here: the issue gate must reject the request
    # before that branch runs at all.
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)
    _insert_pending_test_approval(cycle_id)

    response = _approve_stage_test(client, auth_headers, "finance_user", cycle_id)
    assert response.status_code == 400
    assert response.json()["detail"]["open_issue_count"] == 1


def test_admin_approval_allowed_when_no_finance_issues(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 200


def test_admin_approval_allowed_once_finance_issue_completed(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_issue(client, auth_headers, cycle_id)
    _complete_issue(client, auth_headers, issue["id"])

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 200


def test_admin_approval_allowed_when_issue_raised_in_error(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_issue(client, auth_headers, cycle_id)
    _complete_issue(client, auth_headers, issue["id"], outcome="raised_in_error")

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 200


def test_execution_issue_does_not_block_move_to_live(client, auth_headers, test_actor_id):
    cycle_id = _create_cycle(client, auth_headers)
    billing_user_id = test_actor_id("billing_user")
    definition_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())
    classification_id = str(uuid.uuid4())
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO script_definitions
                    (id, billing_cycle_id, environment, script_type, log_type, parameters, command_text, created_by, created_at)
                VALUES
                    (:id, :billing_cycle_id, 'test', 'preparation', 'daily', '{}', 'echo test', :created_by, now())
                """
            ),
            {"id": definition_id, "billing_cycle_id": cycle_id, "created_by": billing_user_id},
        )
        connection.execute(
            text(
                """
                INSERT INTO script_runs (id, script_definition_id, status, created_at)
                VALUES (:id, :script_definition_id, 'executed', now())
                """
            ),
            {"id": run_id, "script_definition_id": definition_id},
        )
        connection.execute(
            text(
                """
                INSERT INTO billing_issue_classifications (id, context, name, sort_order, is_active, created_at, updated_at)
                VALUES (:id, 'execution_issue', 'Script Failure', 0, true, now(), now())
                """
            ),
            {"id": classification_id},
        )
    response = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": "execution_issue",
            "related_script_run_id": run_id,
            "classification_id": classification_id,
            "title": "Script failed",
            "detail": "Preparation script exited non-zero.",
        },
        headers=auth_headers("billing_user"),
    )
    response.raise_for_status()

    approval_response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert approval_response.status_code == 200


def test_post_live_observation_does_not_block_move_to_live(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id, context="post_live_observation")

    response = _approve_stage_test(client, auth_headers, "system_admin", cycle_id)
    assert response.status_code == 200


def test_finance_can_reject_regardless_of_open_issues(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)
    _insert_pending_test_approval(cycle_id)

    response = _approve_stage_test(client, auth_headers, "finance_user", cycle_id, status="rejected")
    assert response.status_code == 200
