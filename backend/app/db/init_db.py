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
    # Frozen as of the Alembic baseline (backend/alembic/versions/cd4f477b7e33_baseline_existing_schema.py).
    # Do not add new ALTER TABLE statements here for new functionality (e.g. issue-control
    # tables) - write an Alembic migration instead. This function stays only as a safety net
    # for databases that predate the baseline; see docs/DEPLOYMENT_SAFETY.md.
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
            connection.execute(
                text("UPDATE users SET password_hash = :password WHERE password_hash IS NULL OR password_hash = ''"),
                {"password": hash_password("ChangeMe123!")},
            )
    if "name" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)"))
            connection.execute(
                text("UPDATE users SET name = username WHERE name IS NULL OR name = ''")
            )
    if "external_provider" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50)"))
    if "external_subject" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS external_subject VARCHAR(255)"))
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_external_subject ON users (external_subject) WHERE external_subject IS NOT NULL"
                )
            )
    if "last_seen_role" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_role VARCHAR(50)"))
    if "last_seen_groups" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_groups JSONB"))
            connection.execute(
                text("UPDATE users SET last_seen_groups = '[]'::jsonb WHERE last_seen_groups IS NULL")
            )
            connection.execute(
                text("ALTER TABLE users ALTER COLUMN last_seen_groups SET DEFAULT '[]'::jsonb")
            )
            connection.execute(
                text("ALTER TABLE users ALTER COLUMN last_seen_groups SET NOT NULL")
            )
    if "last_login_at" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ"))
    if "auth_metadata" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_metadata TEXT"))
            connection.execute(text("UPDATE users SET auth_metadata = '' WHERE auth_metadata IS NULL"))
            connection.execute(text("ALTER TABLE users ALTER COLUMN auth_metadata SET DEFAULT ''"))
            connection.execute(text("ALTER TABLE users ALTER COLUMN auth_metadata SET NOT NULL"))

    # The signup_requests table itself is left in place (inert - local signup
    # is retired, see docs/entra-id-integration-plan.md) rather than dropped
    # here; dropping it is a schema migration, done separately with explicit
    # approval, not as a side effect of this safety-net function.

    _deactivate_retired_viewer_role()


def _deactivate_retired_viewer_role() -> None:
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE users SET is_active = false WHERE role = 'viewer' AND is_active = true")
        )


def _seed_default_users() -> None:
    # All routine access goes through Entra (see docs/entra-id-integration-plan.md);
    # this is the single break-glass local account kept for the case Entra
    # itself is unavailable or misconfigured. It is not exposed via any
    # signup/self-service path - only pre-existing local login and the admin
    # Users list. Rotate its password after first use if it's ever needed.
    db = SessionLocal()
    try:
        existing = db.scalar(select(models.User).limit(1))
        if existing:
            return

        now = utc_plus_4_now()
        admin = models.User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
            name="Break-Glass Admin",
            username="admin",
            email="admin@example.com",
            role="admin",
            is_active=True,
            password_hash=hash_password("AdminChange2026!"),
            created_at=now,
            updated_at=now,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
