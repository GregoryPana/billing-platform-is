from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.users import UserCreate, UserRead, UserUpdate
from app.services.auth_service import CurrentActor, require_role


router = APIRouter()


@router.get("/", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.post("/", response_model=UserRead)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users are managed in Entra")


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users are managed in Entra")


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentActor = Depends(require_role({"admin"})),
):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users are managed in Entra")
