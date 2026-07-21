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


def _finance_issue_payload(cycle_id: str, classification_name: str = "Loyalty Points", detail: str = "Customer 1234 loyalty points not applied to the test bill.") -> dict:
    return {
        "billing_cycle_id": cycle_id,
        "context": "finance_test_review",
        "classification_id": _classification_id(classification_name),
        "title": "Loyalty points look wrong",
        "detail": detail,
    }


def _create_finance_issue(client, auth_headers, cycle_id: str, **kwargs) -> dict:
    response = client.post(
        "/api/issues/", json=_finance_issue_payload(cycle_id, **kwargs), headers=auth_headers("finance_user")
    )
    response.raise_for_status()
    return response.json()


def _insert_approved_move_to_live(cycle_id: str, approved_by: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO approvals (id, billing_cycle_id, stage, status, approved_by, approved_at, created_at, updated_at)
                VALUES (:id, :billing_cycle_id, 'test', 'approved', :approved_by, now(), now(), now())
                """
            ),
            {"id": str(uuid.uuid4()), "billing_cycle_id": cycle_id, "approved_by": approved_by},
        )


def test_create_finance_issue_records_created_activity(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    assert issue["status"] == "open"
    assert issue["completion_outcome"] is None

    activities = client.get(f"/api/issues/{issue['id']}/activities", headers=auth_headers("finance_user"))
    activities.raise_for_status()
    activity_types = [a["activity_type"] for a in activities.json()]
    assert activity_types == ["created"]


def test_other_classification_rejects_whitespace_only_detail(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = _finance_issue_payload(cycle_id, classification_name="Other", detail="   ")
    response = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user"))
    assert response.status_code == 400


def test_other_classification_accepts_real_detail(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = _finance_issue_payload(
        cycle_id, classification_name="Other", detail="Duplicate charge line appearing on the test bill."
    )
    response = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user"))
    assert response.status_code == 201


def test_comment_is_appended_to_activity_log(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.post(
        f"/api/issues/{issue['id']}/activities",
        json={"comment": "Checked with Cerillion export, points table looks off."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 201
    assert response.json()["activity_type"] == "comment"

    activities = client.get(f"/api/issues/{issue['id']}/activities", headers=auth_headers("finance_user")).json()
    assert [a["activity_type"] for a in activities] == ["created", "comment"]


def test_edit_records_before_and_after_state(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.patch(
        f"/api/issues/{issue['id']}",
        json={"title": "Loyalty points corrected finding", "comment": "Refined title after investigation."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Loyalty points corrected finding"

    activities = client.get(f"/api/issues/{issue['id']}/activities", headers=auth_headers("finance_user")).json()
    edit_activity = next(a for a in activities if a["activity_type"] == "edited")
    assert edit_activity["before_state"]["title"] == "Loyalty points look wrong"
    assert edit_activity["after_state"]["title"] == "Loyalty points corrected finding"
    assert edit_activity["comment"] == "Refined title after investigation."


def test_edit_without_comment_is_rejected(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.patch(
        f"/api/issues/{issue['id']}",
        json={"title": "Missing edit comment"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 422


def test_complete_raised_in_error_requires_comment(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "raised_in_error"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 422


def test_complete_resolved_without_comment_succeeds(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "resolved"},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["completion_outcome"] == "resolved"
    assert body["completed_by"]
    assert body["completed_at"]


def test_complete_raised_in_error_with_comment_succeeds(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)

    response = client.post(
        f"/api/issues/{issue['id']}/complete",
        json={"outcome": "raised_in_error", "comment": "Duplicate of another finding."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 200
    assert response.json()["completion_outcome"] == "raised_in_error"


def test_reopen_before_approval_requires_comment_and_succeeds(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    client.post(
        f"/api/issues/{issue['id']}/complete", json={"outcome": "resolved"}, headers=auth_headers("finance_user")
    ).raise_for_status()

    missing_comment = client.post(
        f"/api/issues/{issue['id']}/reopen", json={}, headers=auth_headers("finance_user")
    )
    assert missing_comment.status_code == 422

    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "New evidence surfaced, reopening for review."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "open"
    assert body["completion_outcome"] is None


def test_reopen_after_move_to_live_approval_is_rejected(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_finance_issue(client, auth_headers, cycle_id)
    client.post(
        f"/api/issues/{issue['id']}/complete", json={"outcome": "resolved"}, headers=auth_headers("finance_user")
    ).raise_for_status()

    finance_login = client.post(
        "/api/auth/login", json={"username_or_email": "finance_user", "password": "ChangeMe123!"}
    )
    _insert_approved_move_to_live(cycle_id, finance_login.json()["user"]["id"])

    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "Trying to reopen after approval."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 400


def test_post_live_observation_cannot_be_reopened(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = _finance_issue_payload(cycle_id)
    payload["context"] = "post_live_observation"
    issue = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user")).json()
    client.post(
        f"/api/issues/{issue['id']}/complete", json={"outcome": "resolved"}, headers=auth_headers("finance_user")
    ).raise_for_status()

    response = client.post(
        f"/api/issues/{issue['id']}/reopen",
        json={"comment": "Attempting to reopen a post-live observation."},
        headers=auth_headers("finance_user"),
    )
    assert response.status_code == 400


def test_list_issues_filters_by_context(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_finance_issue(client, auth_headers, cycle_id)
    payload = _finance_issue_payload(cycle_id)
    payload["context"] = "post_live_observation"
    client.post("/api/issues/", json=payload, headers=auth_headers("finance_user")).raise_for_status()

    response = client.get(
        "/api/issues/",
        params={"billing_cycle_id": cycle_id, "context": "post_live_observation"},
        headers=auth_headers("billing_user"),
    )
    assert response.status_code == 200
    contexts = {issue["context"] for issue in response.json()}
    assert contexts == {"post_live_observation"}


def test_unknown_classification_is_rejected(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    payload = _finance_issue_payload(cycle_id)
    payload["classification_id"] = str(uuid.uuid4())
    response = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user"))
    assert response.status_code == 400


def test_unknown_billing_cycle_is_rejected(client, auth_headers):
    payload = _finance_issue_payload(str(uuid.uuid4()))
    response = client.post("/api/issues/", json=payload, headers=auth_headers("finance_user"))
    assert response.status_code == 404
