from app.services import auth_service
from app.services.entra_auth_service import EntraIdentity

# Mirrors conftest.BREAK_GLASS_ADMIN - the one local account seeded in
# production (see app/db/init_db.py). Not imported directly since `tests`
# isn't a package.
BREAK_GLASS_ADMIN = ("admin", "AdminChange2026!", "system_admin")


def _fake_entra_identity(role: str = "billing_user") -> EntraIdentity:
    return EntraIdentity(
        subject="entra-subject-me",
        name="Entra Test User",
        email="entra.test@example.com",
        role=role,
        groups=[],
        claims={"preferred_username": "entra.test@example.com", "roles": [role]},
    )


def test_local_login_still_works_when_entra_enabled(client, monkeypatch):
    # The only local account left in production is the break-glass admin
    # (see app/db/init_db.py and conftest.BREAK_GLASS_ADMIN) - this exercises
    # the real local login path, not the auth_headers dependency-override
    # shortcut used elsewhere for role-only authorization tests.
    monkeypatch.setattr(auth_service.settings, "entra_enabled", True)
    username, password, expected_role = BREAK_GLASS_ADMIN
    login_response = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
    login_response.raise_for_status()
    token = login_response.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["auth_source"] == "local"
    assert body["role"] == expected_role


def test_me_rejects_garbage_token_when_entra_disabled(client):
    headers = {"Authorization": "Bearer not-a-real-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401


def test_me_falls_back_to_entra_when_local_jwt_invalid_and_entra_enabled(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "entra_enabled", True)
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("finance_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["auth_source"] == "entra_id"
    assert body["role"] == "finance_user"
    assert body["email"] == "entra.test@example.com"


def test_me_does_not_attempt_entra_when_entra_disabled(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "entra_enabled", False)

    def _fail_if_called(token):
        raise AssertionError("validate_entra_token must not be called while ENTRA_ENABLED is false")

    monkeypatch.setattr(auth_service, "validate_entra_token", _fail_if_called)

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401


def test_second_entra_login_reuses_same_user_row(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "entra_enabled", True)
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("finance_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    first_response = client.get("/api/auth/me", headers=headers)
    second_response = client.get("/api/auth/me", headers=headers)
    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["id"] == second_response.json()["id"]


def test_entra_actor_with_disallowed_role_gets_403_on_role_gated_route(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "entra_enabled", True)
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("billing_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/users/", headers=headers)
    assert response.status_code == 403
