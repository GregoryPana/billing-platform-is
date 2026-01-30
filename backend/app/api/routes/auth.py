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
    require_role,
    verify_password,
)
from app.utils.datetime_utils import utc_plus_4_now
from app.config import settings


router = APIRouter()


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
    return TokenResponse(access_token=token, user=UserAuthRead.model_validate(user))


@router.get("/me", response_model=UserAuthRead)
def me(actor: CurrentActor = Depends(require_role({"admin", "billing", "finance", "viewer"})), db: Session = Depends(get_db)):
    user = db.get(User, actor.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserAuthRead.model_validate(user)


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

    admin_email = db.scalar(select(User.email).where(User.role == "admin", User.is_active.is_(True)))
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
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    return list(db.scalars(select(SignupRequest).order_by(SignupRequest.created_at.desc())))


@router.post("/requests/{request_id}/approve", response_model=UserRead)
def approve_signup_request(
    request_id: str,
    payload: SignupApproval,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    if payload.role not in {"billing", "finance", "admin", "viewer"}:
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
        role=payload.role,
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
    return UserRead.model_validate(user)


@router.post("/requests/{request_id}/reject", response_model=SignupRequestRead)
def reject_signup_request(
    request_id: str,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
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
