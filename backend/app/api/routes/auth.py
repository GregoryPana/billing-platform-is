from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

import requests
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.signup_request import SignupRequest
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    SignupApproval,
    SignupRequestCreate,
    SignupRequestRead,
    TokenResponse,
    UserAuthRead,
)
from app.schemas.users import UserRead
from app.services.auth_service import (
    CurrentActor,
    create_access_token,
    hash_password,
    LOCAL_ASSIGNABLE_ROLES,
    normalize_role,
    require_role,
    role_set,
    to_stored_role,
    verify_password,
)
from app.services.audit_service import record_audit_event
from app.utils.datetime_utils import utc_plus_4_now
from app.config import settings


router = APIRouter()


def _auth_user_payload(user: User, auth_source: str = "local") -> UserAuthRead:
    return UserAuthRead(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        role=normalize_role(user.role),
        is_active=user.is_active,
        auth_source=auth_source,
    )


def _user_payload(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        role=normalize_role(user.role),
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(or_(User.username == payload.username_or_email, User.email == payload.username_or_email))
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    token = create_access_token(user)
    record_audit_event(db, str(user.id), "user", "user_access", "user", str(user.id), {"auth_source": "local"})
    return TokenResponse(access_token=token, user=_auth_user_payload(user, auth_source="local"))


@router.get("/me", response_model=UserAuthRead)
def me(actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user", "viewer"))), db: Session = Depends(get_db)):
    user = db.get(User, actor.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    record_audit_event(
        db,
        actor.id,
        actor.actor_type,
        "user_access",
        "user",
        actor.id,
        {"auth_source": actor.auth_source, "role": actor.role, "email": actor.email},
    )
    return _auth_user_payload(user, auth_source=actor.auth_source)


@router.post("/signup", response_model=SignupRequestRead)
def signup(payload: SignupRequestCreate, db: Session = Depends(get_db)):
    if not settings.n8n_signup_webhook_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signup webhook URL not configured")
    existing_user = db.scalar(select(User).where(or_(User.username == payload.username, User.email == payload.email)))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    existing_request = db.scalar(
        select(SignupRequest).where(
            or_(SignupRequest.username == payload.username, SignupRequest.email == payload.email),
            SignupRequest.status == "pending",
        )
    )
    if existing_request:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signup request already pending")

    admin_email = db.scalar(select(User.email).where(User.role.in_(["admin", "system_admin"]), User.is_active.is_(True)))
    if not admin_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active admin email configured")

    try:
        webhook_payload = {
            "body": {
                "username": payload.username,
                "name": payload.name,
                "email": payload.email,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "admin_email": admin_email,
            }
        }
        webhook_response = requests.post(
            settings.n8n_signup_webhook_url,
            json=[webhook_payload],
            timeout=10,
            verify=settings.n8n_webhook_verify,
        )
        if not webhook_response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Signup webhook failed ({webhook_response.status_code})",
            )
    except requests.RequestException as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Signup webhook unreachable") from exc

    request = SignupRequest(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        status="pending",
        created_at=utc_plus_4_now(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return SignupRequestRead.model_validate(request)


@router.get("/requests", response_model=list[SignupRequestRead])
def list_signup_requests(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin"))),
):
    return list(db.scalars(select(SignupRequest).order_by(SignupRequest.created_at.desc())))


@router.post("/requests/{request_id}/approve", response_model=UserRead)
def approve_signup_request(
    request_id: str,
    payload: SignupApproval,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin"))),
):
    if payload.role not in LOCAL_ASSIGNABLE_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    request = db.get(SignupRequest, request_id)
    if not request or request.status != "pending":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup request not found")

    existing_user = db.scalar(
        select(User).where(or_(User.username == request.username, User.email == request.email))
    )
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    user = User(
        name=request.name,
        username=request.username,
        email=request.email,
        role=to_stored_role(payload.role),
        is_active=True,
        password_hash=request.password_hash,
        created_at=utc_plus_4_now(),
        updated_at=utc_plus_4_now(),
    )
    request.status = "approved"
    request.assigned_role = payload.role
    request.reviewed_by = actor.id
    request.reviewed_at = utc_plus_4_now()
    db.add(user)
    db.commit()
    db.refresh(user)
    if settings.n8n_signup_approve_webhook_url:
        try:
            admin_user = db.get(User, actor.id)
            timestamp = datetime.now(timezone.utc).strftime("%d-%m-%Y %H:%M")
            webhook_payload = {
                "body": {
                    "timestamp": timestamp,
                    "admin_name": admin_user.name if admin_user else "",
                    "admin_email": admin_user.email if admin_user else "",
                    "requested_user_name": request.name,
                    "requested_user_username": request.username,
                    "requested_user_email": request.email,
                }
            }
            webhook_response = requests.post(
                settings.n8n_signup_approve_webhook_url,
                json=[webhook_payload],
                timeout=10,
                verify=settings.n8n_webhook_verify,
            )
            if not webhook_response.ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Signup approval webhook failed ({webhook_response.status_code})",
                )
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Signup approval webhook unreachable",
            ) from exc
    return _user_payload(user)


@router.post("/requests/{request_id}/reject", response_model=SignupRequestRead)
def reject_signup_request(
    request_id: str,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role(role_set("system_admin"))),
):
    request = db.get(SignupRequest, request_id)
    if not request or request.status != "pending":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup request not found")
    request.status = "rejected"
    request.reviewed_by = actor.id
    request.reviewed_at = utc_plus_4_now()
    db.commit()
    db.refresh(request)
    return SignupRequestRead.model_validate(request)
