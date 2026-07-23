import json
from dataclasses import dataclass

import jwt
import requests
from fastapi import HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.utils.datetime_utils import utc_plus_4_now


ROLE_PRECEDENCE = ("system_admin", "billing_user", "finance_user")


@dataclass
class EntraIdentity:
    subject: str
    name: str
    email: str
    role: str
    groups: list[str]
    claims: dict


_openid_config_cache: dict | None = None
_jwks_client: PyJWKClient | None = None


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _entra_authority() -> str:
    authority = _clean_optional(settings.entra_authority)
    if authority:
        return authority.rstrip("/")
    tenant_id = _clean_optional(settings.entra_tenant_id)
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entra tenant not configured")
    return f"https://login.microsoftonline.com/{tenant_id}"


def _entra_issuer() -> str:
    issuer = _clean_optional(settings.entra_issuer)
    if issuer:
        return issuer.rstrip("/")
    return f"{_entra_authority()}/v2.0"


def _entra_audience() -> str:
    audience = _clean_optional(settings.entra_audience)
    if audience:
        return audience
    client_id = _clean_optional(settings.entra_client_id)
    if not client_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entra client ID not configured")
    return f"api://{client_id}"


def _openid_config() -> dict:
    global _openid_config_cache
    if _openid_config_cache is not None:
        return _openid_config_cache
    try:
        response = requests.get(f"{_entra_authority()}/v2.0/.well-known/openid-configuration", timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to load Entra OpenID configuration",
        ) from exc
    _openid_config_cache = response.json()
    return _openid_config_cache


def _jwks_client_instance() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    jwks_url = _clean_optional(settings.entra_jwks_url) or _openid_config().get("jwks_uri")
    if not jwks_url:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entra JWKS URL not configured")
    _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def _groups_to_role(groups: list[str]) -> str | None:
    group_roles = {
        _clean_optional(settings.entra_system_admin_group_id): "system_admin",
        _clean_optional(settings.entra_billing_group_id): "billing_user",
        _clean_optional(settings.entra_finance_group_id): "finance_user",
    }
    detected = [role for group_id, role in group_roles.items() if group_id and group_id in groups]
    return _choose_highest_role(detected)


def _choose_highest_role(roles: list[str]) -> str | None:
    available = {role for role in roles if role in ROLE_PRECEDENCE}
    for role in ROLE_PRECEDENCE:
        if role in available:
            return role
    return None


def _claims_to_role(claims: dict) -> str:
    role_claims = claims.get("roles") or []
    if isinstance(role_claims, str):
        role_claims = [role_claims]
    role_value = _choose_highest_role(list(role_claims))
    if role_value:
        return role_value

    groups = claims.get("groups") or []
    if isinstance(groups, str):
        groups = [groups]
    role_from_groups = _groups_to_role(list(groups))
    if role_from_groups:
        return role_from_groups

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permitted Entra role assignment found")


def _principal_email(claims: dict) -> str:
    for key in ("preferred_username", "email", "upn"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Entra token missing email claim")


def validate_entra_token(token: str) -> EntraIdentity:
    try:
        signing_key = _jwks_client_instance().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=_entra_audience(),
            issuer=_entra_issuer(),
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    subject = claims.get("oid") or claims.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Entra token missing subject")

    groups = claims.get("groups") or []
    if isinstance(groups, str):
        groups = [groups]

    return EntraIdentity(
        subject=str(subject),
        name=str(claims.get("name") or claims.get("preferred_username") or "Entra User"),
        email=_principal_email(claims),
        role=_claims_to_role(claims),
        groups=list(groups),
        claims=claims,
    )


def upsert_entra_user(db: Session, identity: EntraIdentity) -> User:
    user = db.scalar(select(User).where(User.external_subject == identity.subject))
    if not user:
        user = db.scalar(select(User).where(or_(User.email == identity.email, User.username == identity.email)))

    now = utc_plus_4_now()
    if not user:
        user = User(
            name=identity.name,
            username=identity.email,
            email=identity.email,
            role=identity.role,
            is_active=True,
            password_hash="",
            external_provider="entra_id",
            external_subject=identity.subject,
            last_seen_role=identity.role,
            last_seen_groups=identity.groups,
            last_login_at=now,
            auth_metadata=json.dumps(
                {
                    "provider": "entra_id",
                    "preferred_username": identity.claims.get("preferred_username"),
                    "roles": identity.claims.get("roles", []),
                }
            ),
            created_at=now,
            updated_at=now,
        )
        db.add(user)
    else:
        user.name = identity.name
        user.username = identity.email
        user.email = identity.email
        user.role = identity.role
        user.is_active = True
        user.external_provider = "entra_id"
        user.external_subject = identity.subject
        user.last_seen_role = identity.role
        user.last_seen_groups = identity.groups
        user.last_login_at = now
        user.auth_metadata = json.dumps(
            {
                "provider": "entra_id",
                "preferred_username": identity.claims.get("preferred_username"),
                "roles": identity.claims.get("roles", []),
            }
        )
        user.updated_at = now

    db.commit()
    db.refresh(user)
    return user
