from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel


class CurrentActor(BaseModel):
    id: str
    role: str
    actor_type: str = "user"


def get_current_actor(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> CurrentActor:
    if not x_user_id or not x_user_role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user headers")
    return CurrentActor(id=x_user_id, role=x_user_role)


def require_role(allowed_roles: set[str]):
    def role_dependency(actor: CurrentActor = Depends(get_current_actor)) -> CurrentActor:
        if actor.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return role_dependency
