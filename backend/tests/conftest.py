import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# Must be set before any `app.*` module is imported, since app.config.settings
# and app.db.session.engine are both built once at import time.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://billing:billing@localhost:5435/billing",
)
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("N8N_WEBHOOK_VERIFY", "false")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

from app.db.session import engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import CurrentActor, EFFECTIVE_TO_STORED_ROLE, get_current_actor  # noqa: E402

# Only one local account exists in production (the break-glass system_admin
# seeded by init_db.py - see app/db/init_db.py). Tests that need to act as a
# given role for authorization/business-logic purposes use TEST_ROLE_ACTORS
# below instead of a real login, so they don't depend on local accounts that
# no longer exist for billing_user/finance_user. Tests that specifically
# exercise the real local login mechanism use BREAK_GLASS_ADMIN directly.
BREAK_GLASS_ADMIN = ("admin", "AdminChange2026!", "system_admin")

TEST_ROLE_ACTORS = {
    "billing_user": {"id": "00000000-0000-0000-0000-000000000101", "email": "test-billing@example.com", "name": "Test Billing User"},
    "finance_user": {"id": "00000000-0000-0000-0000-000000000102", "email": "test-finance@example.com", "name": "Test Finance User"},
    "system_admin": {"id": "00000000-0000-0000-0000-000000000103", "email": "test-admin@example.com", "name": "Test System Admin"},
}


def _seed_test_role_users() -> None:
    # billing_issue_activity.actor_id is a NOT NULL foreign key to users.id,
    # so the fake actors used via dependency_overrides still need a real
    # backing row for any test that logs issue activity.
    session = SessionLocal()
    try:
        for role, info in TEST_ROLE_ACTORS.items():
            session.add(
                User(
                    id=info["id"],
                    name=info["name"],
                    username=f"test-{role}",
                    email=info["email"],
                    role=EFFECTIVE_TO_STORED_ROLE.get(role, role),
                    is_active=True,
                    password_hash="",
                    external_provider="entra_id",
                    external_subject=f"test-{role}",
                )
            )
        session.commit()
    finally:
        session.close()


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return cfg


def _reset_database() -> None:
    """Wipe and re-migrate a disposable test database via the real Alembic
    migration path (not Base.metadata.create_all()), so tests exercise the
    same schema and data-seed steps as a real deploy."""
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    command.upgrade(_alembic_config(), "head")


@pytest.fixture()
def client():
    """A TestClient against a freshly migrated disposable test database.

    App startup still runs init_db() (create_all is then a no-op since
    Alembic already created the tables; user seeding still runs), so tests
    also exercise the same boot behaviour as local/production.
    """
    _reset_database()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_current_actor, None)


@pytest.fixture()
def db_session():
    """A raw session against the same freshly migrated disposable database,
    for tests that assert directly on model/constraint behaviour without
    needing the HTTP app (e.g. model-layer CHECK constraint tests)."""
    _reset_database()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def auth_headers(client: TestClient):
    """Act as a given role via a FastAPI dependency override rather than a
    real login - only one local account (the break-glass admin) exists in
    production, so most tests have no real local account to log in as. Use
    this for authorization/business-logic tests; use a real POST /auth/login
    (see BREAK_GLASS_ADMIN) for tests that exercise the local login
    mechanism itself."""
    _seed_test_role_users()

    def _auth_headers(role: str) -> dict:
        info = TEST_ROLE_ACTORS[role]
        actor = CurrentActor(id=info["id"], role=role, email=info["email"], name=info["name"], auth_source="entra_id")
        app.dependency_overrides[get_current_actor] = lambda: actor
        return {}

    return _auth_headers


@pytest.fixture()
def test_actor_id(auth_headers):
    """The real users.id backing a given role's fake actor (see
    TEST_ROLE_ACTORS) - for tests that need a real user id for a foreign key
    (e.g. script_run.created_by) rather than a real login."""

    def _test_actor_id(role: str) -> str:
        return TEST_ROLE_ACTORS[role]["id"]

    return _test_actor_id
