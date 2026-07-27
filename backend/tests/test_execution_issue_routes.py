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


def _classification_id(name: str, context: str) -> str:
    with engine.begin() as connection:
        row = connection.execute(
            text("SELECT id FROM billing_issue_classifications WHERE context = :context AND name = :name"),
            {"context": context, "name": name},
        ).first()
    return str(row[0])


def _insert_script_definition_and_run(billing_cycle_id: str, created_by: str, status: str = "planned") -> tuple[str, str]:
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
                VALUES (:id, :script_definition_id, :status, now())
                """
            ),
            {"id": run_id, "script_definition_id": definition_id, "status": status},
        )
    return definition_id, run_id


def test_execution_issue_classifications_are_seeded(client, auth_headers):
    response = client.get(
        "/api/issues/classifications?context=execution_issue",
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 200
    names = [item["name"] for item in response.json()]
    assert names == [
        "Script Execution Failure",
        "Parameter or Configuration Issue",
        "Environment or Access Issue",
        "Unexpected Output",
        "Other",
    ]
    assert all(item["is_active"] for item in response.json())


def test_execution_issue_other_requires_detail(client, auth_headers, test_actor_id):
    cycle_id = _create_cycle(client, auth_headers)
    billing_user_id = test_actor_id("billing_user")
    _, run_id = _insert_script_definition_and_run(cycle_id, billing_user_id)
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _classification_id("Other", context="execution_issue"),
        "title": "Something odd",
        "detail": " ",
    }
    response = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert response.status_code == 400


def test_billing_can_list_execution_issues_for_cycle(client, auth_headers, test_actor_id):
    cycle_id = _create_cycle(client, auth_headers)
    billing_user_id = test_actor_id("billing_user")
    _, run_id = _insert_script_definition_and_run(cycle_id, billing_user_id)
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _classification_id("Script Execution Failure", context="execution_issue"),
        "title": "Preparation script failed",
        "detail": "Exited with a non-zero code on the billing host.",
    }
    created = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert created.status_code == 201

    listed = client.get(
        f"/api/issues/?billing_cycle_id={cycle_id}&context=execution_issue",
        headers=auth_headers("finance_user"),
    )
    assert listed.status_code == 200
    issues = listed.json()
    assert len(issues) == 1
    assert issues[0]["related_script_run_id"] == run_id
    assert issues[0]["status"] == "open"


def test_open_execution_issue_does_not_block_run_status_transitions(client, auth_headers, test_actor_id):
    cycle_id = _create_cycle(client, auth_headers)
    billing_user_id = test_actor_id("billing_user")
    _, run_id = _insert_script_definition_and_run(cycle_id, billing_user_id, status="failed")
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _classification_id("Script Execution Failure", context="execution_issue"),
        "title": "Preparation script failed",
        "detail": "Exited with a non-zero code on the billing host.",
    }
    created = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert created.status_code == 201

    # Run status is independently settable to "executed" even with an open
    # execution issue attached -- the issue is operational context only, not
    # a second readiness gate.
    updated = client.patch(
        "/api/runs/",
        json={"script_run_id": run_id, "status": "executed", "notes": "Re-ran manually and it worked."},
        headers=auth_headers("billing_user"),
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "executed"

    run_check = client.get("/api/runs/", headers=auth_headers("billing_user"))
    assert run_check.status_code == 200
    matching = [run for run in run_check.json() if run["id"] == run_id]
    assert matching[0]["status"] == "executed"


def test_execution_issues_never_count_toward_move_to_live_gate(client, auth_headers, test_actor_id):
    cycle_id = _create_cycle(client, auth_headers)
    billing_user_id = test_actor_id("billing_user")
    _, run_id = _insert_script_definition_and_run(cycle_id, billing_user_id)
    payload = {
        "billing_cycle_id": cycle_id,
        "context": "execution_issue",
        "related_script_run_id": run_id,
        "classification_id": _classification_id("Script Execution Failure", context="execution_issue"),
        "title": "Preparation script failed",
        "detail": "Exited with a non-zero code on the billing host.",
    }
    created = client.post("/api/issues/", json=payload, headers=auth_headers("billing_user"))
    assert created.status_code == 201

    approval = client.post(
        "/api/approvals/",
        json={"billing_cycle_id": cycle_id, "stage": "test", "status": "approved", "comments": None},
        headers=auth_headers("system_admin"),
    )
    assert approval.status_code in (200, 201)
