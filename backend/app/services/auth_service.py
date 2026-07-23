from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.entra_auth_service import upsert_entra_user, validate_entra_token


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
LEGACY_TO_EFFECTIVE_ROLE = {
    "admin": "system_admin",
    "system_admin": "system_admin",
    "billing": "billing_user",
    "billing_user": "billing_user",
    "finance": "finance_user",
    "finance_user": "finance_user",
}
EFFECTIVE_TO_STORED_ROLE = {
    "system_admin": "admin",
    "billing_user": "billing",
    "finance_user": "finance",
}
LOCAL_ASSIGNABLE_ROLES = {"admin", "billing", "finance", "system_admin", "billing_user", "finance_user"}


class CurrentActor(BaseModel):
    id: str
    role: str
    email: str | None = None
    name: str | None = None
    auth_source: str = "local"
    actor_type: str = "user"


def normalize_role(value: str | None) -> str:
    normalized = LEGACY_TO_EFFECTIVE_ROLE.get((value or "").strip(), "")
    if not normalized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")
    return normalized


def to_stored_role(value: str) -> str:
    normalized = normalize_role(value)
    return EFFECTIVE_TO_STORED_ROLE.get(normalized, normalized)


def role_set(*values: str) -> set[str]:
    return {normalize_role(value) for value in values}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": str(user.id),
        "role": normalize_role(user.role),
        "exp": expires,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_local_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def _resolve_local_actor(token: str, db: Session) -> CurrentActor:
    payload = _decode_local_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return CurrentActor(
        id=str(user.id),
        role=normalize_role(user.role),
        email=user.email,
        name=user.name,
        auth_source="local",
    )


def _resolve_entra_actor(token: str, db: Session) -> CurrentActor:
    identity = validate_entra_token(token)
    user = upsert_entra_user(db, identity)
    return CurrentActor(
        id=str(user.id),
        role=identity.role,
        email=user.email,
        name=user.name,
        auth_source="entra_id",
    )


def get_current_actor(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentActor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    local_error: HTTPException | None = None
    try:
        return _resolve_local_actor(token, db)
    except HTTPException as exc:
        local_error = exc

    if settings.entra_enabled:
        return _resolve_entra_actor(token, db)

    raise local_error or HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_role(allowed_roles: set[str]):
    normalized_roles = {normalize_role(role) for role in allowed_roles}

    def role_dependency(actor: CurrentActor = Depends(get_current_actor)) -> CurrentActor:
        if actor.role not in normalized_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return role_dependency
