import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.services import entra_auth_service as svc


def test_claims_to_role_prefers_roles_claim_over_groups(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_billing_group_id", "group-billing")
    claims = {"roles": ["finance_user"], "groups": ["group-billing"]}
    assert svc._claims_to_role(claims) == "finance_user"


def test_claims_to_role_falls_back_to_groups_when_no_roles_claim(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_finance_group_id", "group-finance")
    monkeypatch.setattr(svc.settings, "entra_billing_group_id", "group-billing")
    monkeypatch.setattr(svc.settings, "entra_system_admin_group_id", "group-admin")
    claims = {"groups": ["group-finance"]}
    assert svc._claims_to_role(claims) == "finance_user"


def test_claims_to_role_admin_precedence_over_billing_and_finance(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_finance_group_id", "group-finance")
    monkeypatch.setattr(svc.settings, "entra_billing_group_id", "group-billing")
    monkeypatch.setattr(svc.settings, "entra_system_admin_group_id", "group-admin")
    claims = {"groups": ["group-finance", "group-billing", "group-admin"]}
    assert svc._claims_to_role(claims) == "system_admin"


def test_claims_to_role_raises_403_when_no_role_or_group_matches(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_finance_group_id", "group-finance")
    monkeypatch.setattr(svc.settings, "entra_billing_group_id", "group-billing")
    monkeypatch.setattr(svc.settings, "entra_system_admin_group_id", "group-admin")
    claims = {"roles": ["some_other_role"], "groups": ["unmapped-group"]}
    with pytest.raises(HTTPException) as exc_info:
        svc._claims_to_role(claims)
    assert exc_info.value.status_code == 403


def test_claims_to_role_rejects_unknown_role_string(monkeypatch):
    claims = {"roles": ["not_a_real_role"]}
    with pytest.raises(HTTPException) as exc_info:
        svc._claims_to_role(claims)
    assert exc_info.value.status_code == 403


def test_principal_email_prefers_preferred_username():
    claims = {"preferred_username": "User@Example.com", "email": "other@example.com"}
    assert svc._principal_email(claims) == "user@example.com"


def test_principal_email_raises_401_when_no_email_claim():
    with pytest.raises(HTTPException) as exc_info:
        svc._principal_email({})
    assert exc_info.value.status_code == 401


def test_acceptable_issuers_includes_v1_and_v2_when_not_explicitly_set(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_issuer", None)
    monkeypatch.setattr(svc.settings, "entra_authority", None)
    monkeypatch.setattr(svc.settings, "entra_tenant_id", "test-tenant")

    issuers = svc._entra_acceptable_issuers()

    assert "https://login.microsoftonline.com/test-tenant/v2.0" in issuers
    assert "https://sts.windows.net/test-tenant/" in issuers


def test_acceptable_issuers_uses_explicit_override_only(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_issuer", "https://custom-issuer.example.com/v2.0")
    monkeypatch.setattr(svc.settings, "entra_tenant_id", "test-tenant")

    issuers = svc._entra_acceptable_issuers()

    assert issuers == ["https://custom-issuer.example.com/v2.0"]


def test_validate_entra_token_accepts_v1_format_issuer(monkeypatch):
    monkeypatch.setattr(svc, "_jwks_client_instance", lambda: type("K", (), {"get_signing_key_from_jwt": lambda self, t: type("S", (), {"key": "fake-key"})()})())
    monkeypatch.setattr(svc.settings, "entra_audience", "api://test-client-id")
    monkeypatch.setattr(svc.settings, "entra_issuer", None)
    monkeypatch.setattr(svc.settings, "entra_authority", None)
    monkeypatch.setattr(svc.settings, "entra_tenant_id", "test-tenant")

    captured_kwargs = {}

    def fake_decode(token, key, algorithms=None, audience=None, issuer=None):
        captured_kwargs["issuer"] = issuer
        assert issuer == [
            "https://login.microsoftonline.com/test-tenant/v2.0",
            "https://sts.windows.net/test-tenant/",
        ]
        return {
            "oid": "entra-subject-v1",
            "ver": "1.0",
            "preferred_username": "test.user@example.com",
            "roles": ["system_admin"],
        }

    monkeypatch.setattr(svc.jwt, "decode", fake_decode)

    identity = svc.validate_entra_token("fake.token.value")
    assert identity.subject == "entra-subject-v1"
    assert identity.role == "system_admin"
    assert captured_kwargs["issuer"] is not None


def test_acceptable_audiences_includes_uri_and_bare_client_id_when_not_explicitly_set(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_audience", None)
    monkeypatch.setattr(svc.settings, "entra_client_id", "test-client-id")

    audiences = svc._entra_acceptable_audiences()

    assert "api://test-client-id" in audiences
    assert "test-client-id" in audiences


def test_acceptable_audiences_uses_explicit_override_only(monkeypatch):
    monkeypatch.setattr(svc.settings, "entra_audience", "api://custom-audience")
    monkeypatch.setattr(svc.settings, "entra_client_id", "test-client-id")

    audiences = svc._entra_acceptable_audiences()

    assert audiences == ["api://custom-audience"]


def test_validate_entra_token_accepts_bare_client_id_audience(monkeypatch):
    monkeypatch.setattr(svc, "_jwks_client_instance", lambda: type("K", (), {"get_signing_key_from_jwt": lambda self, t: type("S", (), {"key": "fake-key"})()})())
    monkeypatch.setattr(svc.settings, "entra_audience", None)
    monkeypatch.setattr(svc.settings, "entra_client_id", "test-client-id")
    monkeypatch.setattr(svc.settings, "entra_issuer", "https://login.microsoftonline.com/test-tenant/v2.0")

    captured_kwargs = {}

    def fake_decode(token, key, algorithms=None, audience=None, issuer=None):
        captured_kwargs["audience"] = audience
        assert audience == ["api://test-client-id", "test-client-id"]
        return {
            "oid": "entra-subject-bare-aud",
            "aud": "test-client-id",
            "preferred_username": "test.user@example.com",
            "roles": ["system_admin"],
        }

    monkeypatch.setattr(svc.jwt, "decode", fake_decode)

    identity = svc.validate_entra_token("fake.token.value")
    assert identity.subject == "entra-subject-bare-aud"
    assert identity.role == "system_admin"
    assert captured_kwargs["audience"] is not None


def test_validate_entra_token_real_rs256_round_trip(monkeypatch):
    # Every other test here mocks jwt.decode or the signing key, so none of
    # them actually exercise RS256 signature verification - which is exactly
    # how a missing `cryptography` dependency (PyJWT's RS256 backend) stayed
    # invisible through 105/105 "passing" CI runs while every real Entra
    # sign-in failed in production with a generic 401 "Invalid token"
    # (jwt.exceptions.MissingCryptographyError, caught by the broad
    # `except jwt.PyJWTError` in validate_entra_token). This test signs and
    # verifies a real RS256 token so that gap can't recur silently.
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    class FakeSigningKey:
        key = private_key.public_key()

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(svc, "_jwks_client_instance", lambda: FakeJwksClient())
    monkeypatch.setattr(svc.settings, "entra_audience", None)
    monkeypatch.setattr(svc.settings, "entra_client_id", "test-client-id")
    monkeypatch.setattr(svc.settings, "entra_issuer", "https://login.microsoftonline.com/test-tenant/v2.0")

    token = pyjwt.encode(
        {
            "oid": "entra-subject-real-rs256",
            "aud": "test-client-id",
            "iss": "https://login.microsoftonline.com/test-tenant/v2.0",
            "preferred_username": "test.user@example.com",
            "roles": ["system_admin"],
        },
        private_key,
        algorithm="RS256",
    )

    identity = svc.validate_entra_token(token)
    assert identity.subject == "entra-subject-real-rs256"
    assert identity.role == "system_admin"


def _stub_jwks(monkeypatch):
    class FakeSigningKey:
        key = "fake-key"

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(svc, "_jwks_client_instance", lambda: FakeJwksClient())
    monkeypatch.setattr(svc.settings, "entra_audience", "api://test-client-id")
    monkeypatch.setattr(svc.settings, "entra_issuer", "https://login.microsoftonline.com/test-tenant/v2.0")


def test_validate_entra_token_rejects_expired_signature(monkeypatch):
    _stub_jwks(monkeypatch)

    def fake_decode(*args, **kwargs):
        raise svc.jwt.ExpiredSignatureError()

    monkeypatch.setattr(svc.jwt, "decode", fake_decode)

    with pytest.raises(HTTPException) as exc_info:
        svc.validate_entra_token("fake.token.value")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token expired"


def test_validate_entra_token_rejects_invalid_signature(monkeypatch):
    _stub_jwks(monkeypatch)

    def fake_decode(*args, **kwargs):
        raise svc.jwt.InvalidTokenError("bad signature")

    monkeypatch.setattr(svc.jwt, "decode", fake_decode)

    with pytest.raises(HTTPException) as exc_info:
        svc.validate_entra_token("fake.token.value")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


def test_validate_entra_token_maps_claims_to_identity(monkeypatch):
    _stub_jwks(monkeypatch)
    monkeypatch.setattr(
        svc.jwt,
        "decode",
        lambda *a, **k: {
            "oid": "entra-subject-123",
            "name": "Test User",
            "preferred_username": "test.user@example.com",
            "roles": ["billing_user"],
        },
    )

    identity = svc.validate_entra_token("fake.token.value")
    assert identity.subject == "entra-subject-123"
    assert identity.email == "test.user@example.com"
    assert identity.role == "billing_user"
    assert identity.name == "Test User"


def test_validate_entra_token_missing_subject_raises_401(monkeypatch):
    _stub_jwks(monkeypatch)
    monkeypatch.setattr(
        svc.jwt,
        "decode",
        lambda *a, **k: {"preferred_username": "test.user@example.com", "roles": ["billing_user"]},
    )

    with pytest.raises(HTTPException) as exc_info:
        svc.validate_entra_token("fake.token.value")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Entra token missing subject"


def test_upsert_entra_user_creates_new_user(db_session):
    identity = svc.EntraIdentity(
        subject="entra-subject-new",
        name="Brand New User",
        email="brand.new@example.com",
        role="finance_user",
        groups=["group-finance"],
        claims={"preferred_username": "brand.new@example.com", "roles": ["finance_user"]},
    )
    user = svc.upsert_entra_user(db_session, identity)
    assert user.external_provider == "entra_id"
    assert user.external_subject == "entra-subject-new"
    assert user.role == "finance_user"
    assert user.last_seen_role == "finance_user"
    assert user.last_seen_groups == ["group-finance"]
    assert user.last_login_at is not None


def test_upsert_entra_user_updates_existing_row_by_subject(db_session):
    identity = svc.EntraIdentity(
        subject="entra-subject-repeat",
        name="Repeat User",
        email="repeat@example.com",
        role="billing_user",
        groups=["group-billing"],
        claims={"preferred_username": "repeat@example.com", "roles": ["billing_user"]},
    )
    first = svc.upsert_entra_user(db_session, identity)
    first_id = first.id

    changed_identity = svc.EntraIdentity(
        subject="entra-subject-repeat",
        name="Repeat User Renamed",
        email="repeat@example.com",
        role="system_admin",
        groups=["group-admin"],
        claims={"preferred_username": "repeat@example.com", "roles": ["system_admin"]},
    )
    second = svc.upsert_entra_user(db_session, changed_identity)
    assert second.id == first_id
    assert second.name == "Repeat User Renamed"
    assert second.role == "system_admin"
    assert second.last_seen_groups == ["group-admin"]


def test_upsert_entra_user_matches_existing_local_user_by_email(db_session):
    from app.models.user import User
    from app.services.auth_service import hash_password

    local_user = User(
        name="Existing Local User",
        username="existing.local@example.com",
        email="existing.local@example.com",
        role="billing",
        is_active=True,
        password_hash=hash_password("ChangeMe123!"),
    )
    db_session.add(local_user)
    db_session.commit()
    db_session.refresh(local_user)
    local_id = local_user.id

    identity = svc.EntraIdentity(
        subject="entra-subject-migrated",
        name="Existing Local User",
        email="existing.local@example.com",
        role="billing_user",
        groups=[],
        claims={"preferred_username": "existing.local@example.com", "roles": ["billing_user"]},
    )
    migrated = svc.upsert_entra_user(db_session, identity)
    assert migrated.id == local_id
    assert migrated.external_provider == "entra_id"
    assert migrated.external_subject == "entra-subject-migrated"
