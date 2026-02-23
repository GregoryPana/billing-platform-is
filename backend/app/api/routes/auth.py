from datetime import datetime, timezone
import secrets

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.session import UserSession
from app.models.user import User
from app.schemas.auth import UserAuthRead
from app.services.auth_service import (
    CurrentActor,
    build_session_cookie,
    create_session,
    require_role,
    verify_session_cookie,
)
from app.services.auth_service import hash_password
from app.utils.datetime_utils import utc_plus_4_now


router = APIRouter()


ROLE_PRIORITY = ["admin", "billing", "finance", "viewer"]
ROLE_MAPPING = {
    "Admin": "admin",
    "Billing": "billing",
    "Finance": "finance",
    "Viewer": "viewer",
}


def _authorize_url(state: str) -> str:
    params = {
        "client_id": settings.entra_client_id,
        "response_type": "code",
        "redirect_uri": settings.entra_redirect_uri,
        "response_mode": "query",
        "scope": "openid profile email",
        "state": state,
    }
    query = "&".join(f"{key}={requests.utils.quote(value)}" for key, value in params.items())
    return f"{settings.entra_authority}/oauth2/v2.0/authorize?{query}"


def _token_endpoint() -> str:
    return f"{settings.entra_authority}/oauth2/v2.0/token"


def _decode_entra_token(token: str) -> dict:
    unverified = jwt.decode(token, options={"verify_signature": False})
    tenant_id = unverified.get("tid")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing tenant")
    jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    jwk_client = PyJWKClient(jwks_url)
    signing_key = jwk_client.get_signing_key_from_jwt(token)
    issuer = f"https://login.microsoftonline.com/{tenant_id}/v2.0"
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.entra_client_id,
        issuer=issuer,
    )


def _resolve_role(roles: list[str]) -> str:
    normalized = [ROLE_MAPPING.get(role, role).lower() for role in roles]
    for role in ROLE_PRIORITY:
        if role in normalized:
            return role
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No valid role assigned")


@router.get("/entra/login")
def entra_login(response: Response):
    if not settings.entra_client_id or not settings.entra_redirect_uri:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entra settings not configured")
    state = secrets.token_urlsafe(24)
    response = RedirectResponse(url=_authorize_url(state))
    response.set_cookie(
        "entra_state",
        state,
        httponly=True,
        secure=settings.environment != "local",
        samesite="lax",
        max_age=600,
        path="/",
    )
    return response


@router.get("/entra/callback")
def entra_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    if not code or not state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing auth code")
    expected_state = request.cookies.get("entra_state")
    if not expected_state or expected_state != state:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid state")

    token_response = requests.post(
        _token_endpoint(),
        data={
            "client_id": settings.entra_client_id,
            "client_secret": settings.entra_client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.entra_redirect_uri,
            "scope": "openid profile email",
        },
        timeout=10,
    )
    if not token_response.ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Entra token exchange failed")

    token_payload = token_response.json()
    id_token = token_payload.get("id_token")
    access_token = token_payload.get("access_token")
    if not id_token and not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    decoded = _decode_entra_token(id_token or access_token)
    roles = decoded.get("roles") or []
    if not roles and id_token and access_token:
        decoded = _decode_entra_token(access_token)
        roles = decoded.get("roles") or []
    if not roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No roles assigned")

    effective_role = _resolve_role(roles)
    entra_oid = decoded.get("oid")
    tenant_id = decoded.get("tid")
    name = decoded.get("name") or ""
    email = decoded.get("preferred_username") or decoded.get("email") or ""
    if not entra_oid or not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user identity")

    user = db.scalar(select(User).where(User.entra_oid == entra_oid, User.entra_tenant_id == tenant_id))
    if not user and email:
        user = db.scalar(select(User).where(User.email == email))

    username = email or entra_oid
    if not user:
        existing_username = db.scalar(select(User).where(User.username == username))
        if existing_username:
            username = f"{username}_{entra_oid[:6]}"
        user = User(
            name=name or username,
            username=username,
            email=email or f"{entra_oid}@entra.local",
            role=effective_role,
            entra_oid=entra_oid,
            entra_tenant_id=tenant_id,
            entra_roles=roles,
            is_active=True,
            password_hash=hash_password(secrets.token_urlsafe(20)),
            created_at=utc_plus_4_now(),
            updated_at=utc_plus_4_now(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = name or user.name
        if email:
            user.email = email
        user.role = effective_role
        user.entra_oid = entra_oid
        user.entra_tenant_id = tenant_id
        user.entra_roles = roles
        user.updated_at = utc_plus_4_now()
        db.commit()

    session = create_session(
        db,
        user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    session_cookie = build_session_cookie(str(session.id))
    redirect = RedirectResponse(url=settings.frontend_url)
    redirect.set_cookie(
        settings.session_cookie_name,
        session_cookie,
        httponly=True,
        secure=settings.environment != "local",
        samesite="lax",
        max_age=settings.session_exp_minutes * 60,
        path="/",
    )
    redirect.delete_cookie("entra_state")
    return redirect


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    session_cookie = request.cookies.get(settings.session_cookie_name)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    if not session_cookie:
        return response
    session_id = verify_session_cookie(session_cookie)
    if not session_id:
        response.delete_cookie(settings.session_cookie_name)
        return response
    session = db.get(UserSession, session_id)
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(settings.session_cookie_name)
    return response


@router.get("/me", response_model=UserAuthRead)
def me(actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})), db: Session = Depends(get_db)):
    user = db.get(User, actor.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAuthRead.model_validate(user)
