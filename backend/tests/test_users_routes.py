from sqlalchemy import text

from app.db.session import engine
from app.services.auth_service import hash_password


def test_list_users_tolerates_legacy_unrecognized_role(client, auth_headers):
    # Regression test for a real production incident: a leftover local
    # "viewer" row (retired in 8f6d8db) made GET /api/users/ 403 with
    # "Unknown role" for every admin, not just fail to render that one row,
    # because _user_payload called normalize_role() unguarded on every user.
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users (id, name, username, email, role, is_active, password_hash, last_seen_groups, auth_metadata, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Legacy Viewer', 'legacy_viewer', 'legacy_viewer@example.com', 'viewer', false,
                        :password_hash, '[]', '', now(), now())
                """
            ),
            {"password_hash": hash_password("ChangeMe123!")},
        )

    response = client.get("/api/users/", headers=auth_headers("system_admin"))
    assert response.status_code == 200
    roles_by_username = {user["username"]: user["role"] for user in response.json()}
    assert roles_by_username["legacy_viewer"] == "viewer"
    assert roles_by_username["admin"] == "system_admin"
