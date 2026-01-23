from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.users import UserRead
from app.services.auth_service import CurrentActor, require_role


router = APIRouter()


@router.get("/", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    return list(db.scalars(select(User).order_by(User.created_at.desc())))
