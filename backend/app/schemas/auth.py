from uuid import UUID

from app.schemas.base import BaseSchema


class LoginRequest(BaseSchema):
    username_or_email: str
    password: str


class UserAuthRead(BaseSchema):
    id: UUID
    name: str
    username: str
    email: str
    role: str
    is_active: bool
    auth_source: str = "local"


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    user: UserAuthRead
