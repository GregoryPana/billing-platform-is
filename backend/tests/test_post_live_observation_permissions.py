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


def _observation_payload(cycle_id: str) -> dict:
    return {
        "billing_cycle_id": cycle_id,
        "context": "post_live_observation",
        "classification_id": _classification_id("Loyalty Points"),
        "title": "Loyalty points discrepancy noticed post-live",
        "detail": "Customer 5678 loyalty points looked off on the live bill after send-out.",
    }


def _create_observation(client, auth_headers, cycle_id: str, role: str = "finance_user") -> dict:
    response = client.post("/api/issues/", json=_observation_payload(cycle_id), headers=auth_headers(role))
    response.raise_for_status()
    return response.json()


def test_billing_cannot_create_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post("/api/issues/", json=_observation_payload(cycle_id), headers=auth_headers("billing_user"))
    assert response.status_code == 403


def test_finance_can_create_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post("/api/issues/", json=_observation_payload(cycle_id), headers=auth_headers("finance_user"))
    assert response.status_code == 201
    assert response.json()["status"] == "open"


def test_admin_can_create_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    response = client.post("/api/issues/", json=_observation_payload(cycle_id), headers=auth_headers("system_admin"))
    assert response.status_code == 201


def test_all_three_roles_can_read_post_live_observations(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_observation(client, auth_headers, cycle_id)
    for role in ("billing_user", "finance_user", "system_admin"):
        response = client.get(
            "/api/issues/",
            params={"billing_cycle_id": cycle_id, "context": "post_live_observation"},
            headers=auth_headers(role),
        )
        assert response.status_code == 200, role
        assert len(response.json()) == 1


def test_billing_cannot_comment_on_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/activities",
        json={"comment": "Just curious"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_finance_can_comment_on_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/activities",
        json={"comment": "Confirmed with Cerillion export, logging for trend tracking."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 201


def test_billing_cannot_edit_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    response = client.patch(
        f"/api/issues/{issue['id']}",
        json={"title": "Updated title", "comment": "Correcting title"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_finance_can_complete_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_billing_cannot_complete_post_live_observation(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 403


def test_completed_post_live_observation_cannot_be_reopened_by_finance(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)
    client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("finance_user"),
    ).raise_for_status()

    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "Reopening to double-check"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 400


def test_open_post_live_observation_cannot_be_reopened_either(client, auth_headers):
    # Reopen is only meaningful for completed issues, but confirm the
    # context check rejects post_live_observation before the status check
    # would even matter -- reopening is not supported for this context at all.
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_observation(client, auth_headers, cycle_id)

    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "Attempting to reopen an open observation"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 400
    assert "test-review" in response.json()["detail"]


def test_post_live_observation_shares_finance_classification_list(client, auth_headers):
    response = client.get("/api/issues/classifications?context=finance_review", headers=auth_headers("finance_user"))
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert {"Loyalty Points", "Bill with Zero or Negative Value", "Incorrect Product Setup", "Other"} <= names
