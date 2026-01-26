from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class LoginRequest(BaseSchema):
    username_or_email: str
    password: str


class SignupRequestCreate(BaseSchema):
    username: str
    email: str
    password: str


class SignupRequestRead(BaseSchema):
    id: UUID
    username: str
    email: str
    status: str
    assigned_role: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class SignupApproval(BaseSchema):
    role: str


class UserAuthRead(BaseSchema):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    user: UserAuthRead

