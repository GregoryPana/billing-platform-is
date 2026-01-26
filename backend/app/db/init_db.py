import uuid

from sqlalchemy import inspect, select, text

from app import models
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.auth_service import hash_password
from app.utils.datetime_utils import utc_plus_4_now


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_schema_updates()
    _seed_default_users()


def _apply_schema_updates() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
            connection.execute(
                text("UPDATE users SET password_hash = :password WHERE password_hash IS NULL OR password_hash = ''"),
                {"password": hash_password("ChangeMe123!")},
            )


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
                password_hash=hash_password("ChangeMe123!"),
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
                username="finance_user",
                email="finance@example.com",
                role="finance",
                is_active=True,
                password_hash=hash_password("ChangeMe123!"),
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
                username="admin",
                email="admin@example.com",
                role="admin",
                is_active=True,
                password_hash=hash_password("AdminChange123!"),
                created_at=now,
                updated_at=now,
            ),
            models.User(
                id=uuid.UUID("00000000-0000-0000-0000-000000000004"),
                username="viewer",
                email="viewer@example.com",
                role="viewer",
                is_active=True,
                password_hash=hash_password("ChangeMe123!"),
                created_at=now,
                updated_at=now,
            ),
        ]
        db.add_all(users)
        db.commit()
    finally:
        db.close()
