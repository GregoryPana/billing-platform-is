import uuid

from sqlalchemy import select

from app import models
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.utils.datetime_utils import utc_plus_4_now


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_default_users()


def _seed_default_users() -> None:
    db = SessionLocal()
    try:
        existing = db.scalar(select(models.User).limit(1))
        if existing:
            return

        now = utc_plus_4_now()
        users = [
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                username="billing_user",
                email="billing@example.com",
                role="billing",
                is_active=True,
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
                username="finance_user",
                email="finance@example.com",
                role="finance",
                is_active=True,
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
                username="admin",
                email="admin@example.com",
                role="admin",
                is_active=True,
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000004"),
                username="viewer",
                email="viewer@example.com",
                role="viewer",
                is_active=True,
                created_at=now,
                updated_at=now,
            ),
        ]
        db.add_all(users)
        db.commit()
    finally:
        db.close()
