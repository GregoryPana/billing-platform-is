from sqlalchemy import text

from app.db.session import engine


def _create_cycle(client, auth_headers, usage_month="2026-06", billing_month="2026-07"):
    response = client.post(
        "/api/cycles/",
        json={"usage_month": usage_month, "billing_month": billing_month},
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


def _create_issue(client, auth_headers, cycle_id, context="finance_test_review", classification="Loyalty Points"):
    response = client.post(
        "/api/issues/",
        json={
            "billing_cycle_id": cycle_id,
            "context": context,
            "classification_id": _classification_id(classification),
            "title": "Issue",
            "detail": "Some detail about the issue.",
        },
        headers=auth_headers("finance_user"),
    )
    response.raise_for_status()
    return response.json()


def _complete_issue(client, auth_headers, issue_id, outcome="resolved"):
    payload = {"outcome": outcome}
    if outcome == "raised_in_error":
        payload["comment"] = "Duplicate finding, no action needed."
    response = client.post(f"/api/issues/{issue_id}/complete", json=payload, headers=auth_headers("finance_user"))
    response.raise_for_status()
    return response.json()


def _approve_stage_test(client, auth_headers, cycle_id, role="system_admin"):
    return client.post(
        "/api/approvals/",
        json={"billing_cycle_id": cycle_id, "stage": "test", "status": "approved", "comments": None},
        headers=auth_headers(role),
    )


def test_billing_user_forbidden(client, auth_headers):
    response = client.get("/api/issue-reporting/summary", headers=auth_headers("billing_user"))
    assert response.status_code == 403


def test_unauthenticated_rejected(client):
    response = client.get("/api/issue-reporting/summary")
    assert response.status_code == 401


def test_empty_state_when_no_data(client, auth_headers):
    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    assert response.status_code == 200
    body = response.json()
    metrics = body["metrics"]
    for key in (
        "test_review_issues_by_cycle",
        "classification_breakdown",
        "test_review_vs_post_live",
        "completion_turnaround",
        "cycles_blocked_by_open_issue",
        "raised_in_error",
    ):
        metric = metrics[key]
        assert metric["is_empty"] is True
        assert metric["source"]
        assert metric["filter_scope"]
        assert metric["decision_supported"]


def test_admin_can_view_summary(client, auth_headers):
    response = client.get("/api/issue-reporting/summary", headers=auth_headers("system_admin"))
    assert response.status_code == 200


def test_test_review_issues_by_cycle_counts(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)
    _create_issue(client, auth_headers, cycle_id)

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["test_review_issues_by_cycle"]
    assert metric["is_empty"] is False
    row = next(row for row in metric["data"] if row["billing_cycle_id"] == cycle_id)
    assert row["count"] == 2
    assert row["billing_month"] == "2026-07"


def test_classification_breakdown_excludes_raised_in_error(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    resolved_issue = _create_issue(client, auth_headers, cycle_id, classification="Loyalty Points")
    error_issue = _create_issue(client, auth_headers, cycle_id, classification="Other")
    _complete_issue(client, auth_headers, resolved_issue["id"], outcome="resolved")
    _complete_issue(client, auth_headers, error_issue["id"], outcome="raised_in_error")

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["classification_breakdown"]
    names = {row["classification"]: row["count"] for row in metric["data"]}
    assert names.get("Loyalty Points") == 1
    assert "Other" not in names


def test_test_review_vs_post_live_counts(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id, context="finance_test_review")
    _create_issue(client, auth_headers, cycle_id, context="post_live_observation")
    _create_issue(client, auth_headers, cycle_id, context="post_live_observation")

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["test_review_vs_post_live"]
    counts = {row["context"]: row["count"] for row in metric["data"]}
    assert counts["finance_test_review"] == 1
    assert counts["post_live_observation"] == 2


def test_completion_turnaround_sample_size(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    issue = _create_issue(client, auth_headers, cycle_id)
    _create_issue(client, auth_headers, cycle_id)  # left open, must not count
    _complete_issue(client, auth_headers, issue["id"])

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["completion_turnaround"]
    assert metric["is_empty"] is False
    assert metric["data"]["sample_size"] == 1
    assert metric["data"]["average_hours"] >= 0


def test_cycles_blocked_by_open_issue(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    _create_issue(client, auth_headers, cycle_id)

    blocked_response = _approve_stage_test(client, auth_headers, cycle_id)
    assert blocked_response.status_code == 400

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["cycles_blocked_by_open_issue"]
    assert metric["is_empty"] is False
    row = next(row for row in metric["data"] if row["billing_cycle_id"] == cycle_id)
    assert row["blocked_count"] == 1


def test_cycles_blocked_ignores_unblocked_approvals(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)

    response = _approve_stage_test(client, auth_headers, cycle_id)
    assert response.status_code == 200

    summary = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = summary.json()["metrics"]["cycles_blocked_by_open_issue"]
    assert metric["is_empty"] is True


def test_raised_in_error_measure(client, auth_headers):
    cycle_id = _create_cycle(client, auth_headers)
    resolved_issue = _create_issue(client, auth_headers, cycle_id)
    error_issue = _create_issue(client, auth_headers, cycle_id)
    _complete_issue(client, auth_headers, resolved_issue["id"], outcome="resolved")
    _complete_issue(client, auth_headers, error_issue["id"], outcome="raised_in_error")

    response = client.get("/api/issue-reporting/summary", headers=auth_headers("finance_user"))
    metric = response.json()["metrics"]["raised_in_error"]
    assert metric["is_empty"] is False
    assert metric["data"]["count"] == 1
    assert metric["data"]["percentage_of_completed"] == 50.0


def test_filter_by_billing_cycle_id(client, auth_headers):
    cycle_a = _create_cycle(client, auth_headers, usage_month="2026-06", billing_month="2026-07")
    cycle_b = _create_cycle(client, auth_headers, usage_month="2026-07", billing_month="2026-08")
    _create_issue(client, auth_headers, cycle_a)
    _create_issue(client, auth_headers, cycle_b)
    _create_issue(client, auth_headers, cycle_b)

    response = client.get(
        f"/api/issue-reporting/summary?billing_cycle_id={cycle_b}", headers=auth_headers("finance_user")
    )
    metric = response.json()["metrics"]["test_review_issues_by_cycle"]
    assert len(metric["data"]) == 1
    assert metric["data"][0]["billing_cycle_id"] == cycle_b
    assert metric["data"][0]["count"] == 2


def test_filter_by_month_range(client, auth_headers):
    cycle_in_range = _create_cycle(client, auth_headers, usage_month="2026-06", billing_month="2026-07")
    cycle_out_of_range = _create_cycle(client, auth_headers, usage_month="2026-01", billing_month="2026-02")
    _create_issue(client, auth_headers, cycle_in_range)
    _create_issue(client, auth_headers, cycle_out_of_range)

    response = client.get(
        "/api/issue-reporting/summary?start_month=2026-06&end_month=2026-07",
        headers=auth_headers("finance_user"),
    )
    metric = response.json()["metrics"]["test_review_issues_by_cycle"]
    cycle_ids = {row["billing_cycle_id"] for row in metric["data"]}
    assert cycle_in_range in cycle_ids
    assert cycle_out_of_range not in cycle_ids
