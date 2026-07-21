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


def _insert_execution_classification() -> str:
    # No execution_issue classification is seeded by any migration yet (see
    # billing_issue.py: "an operational list to be agreed during
    # implementation"). Insert one directly so execution-issue creation can be
    # exercised ahead of that later reference-data decision.
    classification_id = str(uuid.uuid4())
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO billing_issue_classifications (id, context, name, sort_order, is_active, created_at, updated_at)
                VALUES (:id, 'execution_issue', 'Script Failure', 0, true, now(), now())
                ON CONFLICT DO NOTHING
                """
            ),
            {"id": classification_id},
        )
    return _classification_id("Script Failure", context="execution_issue")


def _insert_script_run(billing_cycle_id: str, created_by: str) -> str:
    definition_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())
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
            {"id": definition_id, "billing_cycle_id": billing_cycle_id, "created_by": created_by},
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
    return run_id


def _finance_issue_payload(cycle_id: str) -> dict:
    return {
        "billing_cycle_id": cycle_id,
        "context": "finance_test_review",
        "classification_id": _classification_id("Loyalty Points"),
        "title": "Loyalty points look wrong",
        "detail": "Customer 1234 loyalty points not applied to the test bill.",
    }


def _create_finance_issue(client, auth_headers, cycle_id: str) -> dict:
    response = client.post("/api/issues/", json=_finance_issue_payload(cycle_id), headers=auth_headers("finance_user"))
    response.raise_for_status()
    return response.json()


def test_list_issues_rejects_missing_token(client):
    response = client.get("/api/issues/", params={"billing_cycle_id": str(uuid.uuid4())})
    assert response.status_code == 401


def test_all_three_roles_can_read_issues(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    for role in ("billing_user", "finance_user", "system_admin"):
        response = client.get("/api/issues/", params={"billing_cycle_id": cycle_id}, headers=auth_headers(role))
        assert response.status_code == 200, role


def test_billing_cannot_create_finance_test_review_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post(
        "/api/issues/", json=_finance_issue_payload(cycle_id), headers=auth_headers("billing_user")
    )
    assert response.status_code == 403


def test_billing_cannot_create_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = _finance_issue_payload(cycle_id)
    payload["context"] = "post_live_observation"
    response = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert response.status_code == 403


def test_finance_can_create_finance_test_review_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post(
        "/api/issues/", json=_finance_issue_payload(cycle_id), headers=auth_headers("finance_user")
    )
    assert response.status_code == 201


def test_admin_can_create_finance_test_review_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post(
        "/api/issues/", json=_finance_issue_payload(cycle_id), headers=auth_headers("system_admin")
    )
    assert response.status_code == 201


def test_finance_cannot_create_execution_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    login = client.post("/api/auth/login", json={"username_or_email": "billing_user", "password": "ChangeMe123!"})
    run_id = _insert_script_run(cycle_id, login.json()["user"]["id"])
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _insert_execution_classification(),
        "title": "Script failed",
        "detail": "Preparation script exited non-zero.",
    }
    response = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user"))
    assert response.status_code == 403


def test_billing_can_create_execution_issue_with_related_run(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    login = client.post("/api/auth/login", json={"username_or_email": "billing_user", "password": "ChangeMe123!"})
    run_id = _insert_script_run(cycle_id, login.json()["user"]["id"])
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _insert_execution_classification(),
        "title": "Script failed",
        "detail": "Preparation script exited non-zero.",
    }
    response = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert response.status_code == 201
    assert response.json()["related_script_run_id"] == run_id


def test_execution_issue_without_related_run_is_rejected(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "classification_id": _insert_execution_classification(),
        "title": "Script failed",
        "detail": "Preparation script exited non-zero.",
    }
    response = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert response.status_code == 400


def test_billing_cannot_comment_on_finance_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/activities",
        json={"comment": "Looks fine to me"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_finance_can_comment_on_finance_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/activities",
        json={"comment": "Investigating with Cerillion export."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 201


def test_billing_cannot_edit_finance_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    response = client.patch(
        f"/api/issues/{issue['id']}",
        json={"title": "Updated title", "comment": "Correcting title"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_billing_cannot_complete_finance_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_billing_cannot_reopen_finance_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("finance_user"),
    ).raise_for_status()
    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "Reopening to double-check"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403
