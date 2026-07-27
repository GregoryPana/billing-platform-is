from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserAuthRead
from app.services.auth_service import CurrentActor, create_access_token, normalize_role, require_role, role_set, verify_password
from app.services.audit_service import record_audit_event


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
def me(actor: CurrentActor = Depends(require_role(role_set("system_admin", "billing_user", "finance_user"))), db: Session = Depends(get_db)):
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
