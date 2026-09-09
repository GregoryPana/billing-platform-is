from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User
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


def test_local_login_works_in_local_auth_mode(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "local")
    username, password, expected_role = BREAK_GLASS_ADMIN
    login_response = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
    login_response.raise_for_status()
    token = login_response.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["auth_source"] == "local"
    assert body["role"] == expected_role


def test_me_rejects_garbage_token_in_local_auth_mode(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "local")
    headers = {"Authorization": "Bearer not-a-real-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401


def test_login_rejects_local_credentials_in_entra_auth_mode(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    username, password, _ = BREAK_GLASS_ADMIN
    response = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
    assert response.status_code == 404


def test_local_jwt_rejected_in_entra_auth_mode_even_when_valid(client, monkeypatch):
    # First mint a real, valid local JWT while still in local mode ...
    monkeypatch.setattr(auth_service.settings, "auth_mode", "local")
    username, password, _ = BREAK_GLASS_ADMIN
    login_response = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
    login_response.raise_for_status()
    token = login_response.json()["access_token"]

    # ... then switch to Entra mode: the same, still-valid local JWT must go
    # through Entra validation, not local JWT decode. Mock
    # validate_entra_token to prove it is the path actually reached,
    # regardless of what the token itself contains.
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda t: _fake_entra_identity())

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["auth_source"] == "entra_id"


def test_me_uses_entra_when_auth_mode_is_entra(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("finance_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["auth_source"] == "entra_id"
    assert body["role"] == "finance_user"
    assert body["email"] == "entra.test@example.com"


def test_me_never_attempts_entra_when_auth_mode_is_local(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "local")

    def _fail_if_called(token):
        raise AssertionError("validate_entra_token must not be called while AUTH_MODE=local")

    monkeypatch.setattr(auth_service, "validate_entra_token", _fail_if_called)

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401


def test_second_entra_login_reuses_same_user_row(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("finance_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    first_response = client.get("/api/auth/me", headers=headers)
    second_response = client.get("/api/auth/me", headers=headers)
    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["id"] == second_response.json()["id"]


def test_deactivated_entra_user_remains_inactive_and_is_denied(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity())
    headers = {"Authorization": "Bearer entra-style-opaque-token"}

    first_response = client.get("/api/auth/me", headers=headers)
    assert first_response.status_code == 200

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.external_subject == "entra-subject-me"))
        assert user is not None
        setattr(user, "is_active", False)
        db.commit()

    second_response = client.get("/api/auth/me", headers=headers)
    assert second_response.status_code == 401
    assert second_response.json()["detail"] == "Inactive user"

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.external_subject == "entra-subject-me"))
        assert user is not None
        assert user.is_active is False


def test_entra_actor_with_disallowed_role_gets_403_on_role_gated_route(client, monkeypatch):
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service, "validate_entra_token", lambda token: _fake_entra_identity("billing_user"))

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/users/", headers=headers)
    assert response.status_code == 403


def test_entra_auth_mode_fails_closed_with_incomplete_entra_config(client, monkeypatch):
    # No tenant/client ID configured at all - this must surface an
    # actionable configuration error (500), never a silent fall back to
    # local auth (there is no local auth path to fall back to in this mode).
    monkeypatch.setattr(auth_service.settings, "auth_mode", "entra")
    monkeypatch.setattr(auth_service.settings, "entra_tenant_id", None)
    monkeypatch.setattr(auth_service.settings, "entra_authority", None)
    monkeypatch.setattr(auth_service.settings, "entra_client_id", None)
    monkeypatch.setattr(auth_service.settings, "entra_audience", None)

    headers = {"Authorization": "Bearer entra-style-opaque-token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 500
    assert "not configured" in response.json()["detail"].lower()
