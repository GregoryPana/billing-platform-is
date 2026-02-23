from datetime import datetime, timedelta, timezone
from hmac import compare_digest
import hmac
import hashlib

from fastapi import Depends, Cookie, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.session import UserSession
from app.models.user import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CurrentActor(BaseModel):
    id: str
    role: str
    actor_type: str = "user"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_session(
    db: Session,
    user: User,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> UserSession:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.session_exp_minutes)
    session = UserSession(
        user_id=user.id,
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _sign_session_id(session_id: str) -> str:
    signature = hmac.new(
        settings.session_secret.encode("utf-8"),
        session_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{session_id}.{signature}"


def _verify_signed_session(value: str) -> str | None:
    if not value or "." not in value:
        return None
    session_id, signature = value.rsplit(".", 1)
    expected = hmac.new(
        settings.session_secret.encode("utf-8"),
        session_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not compare_digest(signature, expected):
        return None
    return session_id


def get_current_actor(
    session_cookie: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    db: Session = Depends(get_db),
) -> CurrentActor:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session")
    session_id = _verify_signed_session(session_cookie)
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    session = db.get(UserSession, session_id)
    if not session or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return CurrentActor(id=str(user.id), role=user.role)


def require_role(allowed_roles: set[str]):
    def role_dependency(actor: CurrentActor = Depends(get_current_actor)) -> CurrentActor:
        if actor.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return role_dependency


def build_session_cookie(session_id: str) -> str:
    return _sign_session_id(session_id)


def verify_session_cookie(value: str | None) -> str | None:
    if not value:
        return None
    return _verify_signed_session(value)
