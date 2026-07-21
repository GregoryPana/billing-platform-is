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

from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

SEEDED_USERS = {
    "billing_user": ("billing_user", "ChangeMe123!", "billing_user"),
    "finance_user": ("finance_user", "ChangeMe123!", "finance_user"),
    "system_admin": ("admin", "AdminChange2026!", "system_admin"),
}


@pytest.fixture()
def client():
    """A TestClient against a wiped-and-reseeded disposable test database.

    Runs the app's real startup path (init_db: create_all + seed) so tests
    exercise the same boot behaviour as local/production, against a database
    that only this test suite should ever point at.
    """
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client: TestClient):
    def _auth_headers(role: str) -> dict:
        username, password, _ = SEEDED_USERS[role]
        response = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
        response.raise_for_status()
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers
