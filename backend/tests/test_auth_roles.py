from sqlalchemy import text

from app.db.session import engine
from app.services.auth_service import hash_password


def test_seeded_system_admin_can_log_in(client):
    # This is the only local account seeded in production - the break-glass
    # admin (see app/db/init_db.py). billing_user/finance_user are no longer
    # seeded as local accounts; those roles are Entra-only, exercised via the
    # auth_headers fixture (dependency override) in other test files rather
    # than a real login.
    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "admin", "password": "AdminChange2026!"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "system_admin"


def test_retired_viewer_role_cannot_authenticate(client):
    # The default seed no longer creates a viewer user (see init_db.py), so
    # simulate a pre-existing local viewer row that predates the retirement
    # and confirm it is rejected rather than silently granted access.
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users (id, name, username, email, role, is_active, password_hash, last_seen_groups, auth_metadata, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Legacy Viewer', 'legacy_viewer', 'legacy_viewer@example.com', 'viewer', true,
                        :password_hash, '[]', '', now(), now())
                """
            ),
            {"password_hash": hash_password("ChangeMe123!")},
        )

    response = client.post(
        "/api/auth/login",
        json={"username_or_email": "legacy_viewer", "password": "ChangeMe123!"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Unknown role"


def test_cycles_endpoint_rejects_missing_token(client):
    response = client.get("/api/cycles/")
    assert response.status_code == 401


def test_cycles_endpoint_allows_billing_user(client, auth_headers):
    response = client.get("/api/cycles/", headers=auth_headers("billing_user"))
    assert response.status_code == 200
