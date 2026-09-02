from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


VALID_AUTH_MODES = {"local", "entra"}


class Settings(BaseSettings):
    # extra="ignore": production's .env is written unconditionally by
    # .github/workflows/ci.yml regardless of which settings this app
    # currently declares (see N8N_SIGNUP_WEBHOOK_URL/N8N_SIGNUP_APPROVE_WEBHOOK_URL,
    # removed here but still written to .env by that workflow). Without this,
    # any settings field retired here crashes app startup - including
    # `alembic upgrade head`, which imports this module - until ci.yml is
    # separately updated to match, which is exactly the kind of two-repo-file
    # coordination that's easy to miss.
    model_config = SettingsConfigDict(env_file=(".env.local", ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Billing Platform API"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://billing:billing@localhost:5432/billing"
    timezone_offset_hours: int = 4
    n8n_webhook_url: str | None = None
    n8n_approval_webhook_url: str | None = None
    n8n_webhook_verify: bool = True
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 480
    # AUTH_MODE is the authoritative authentication-mode contract for this
    # app - "local" (default, local JWT auth only - what tests and
    # controlled local dev use) or "entra" (Entra ID is the only accepted
    # authentication source; local login/JWT are refused outright). Do not
    # gate production authentication behavior on entra_tenant_id/
    # entra_client_id being merely present, and do not reintroduce a
    # standalone permissive boolean (e.g. ENTRA_ENABLED) as a second way to
    # turn Entra on - AUTH_MODE is the single source of truth.
    auth_mode: str = "local"

    @field_validator("auth_mode", mode="after")
    @classmethod
    def _validate_auth_mode(cls, value: str) -> str:
        # Fail closed at settings construction/startup - an invalid
        # AUTH_MODE must never silently become "local" (or any other
        # unintended mode); a typo'd or misconfigured value should crash
        # startup, not open a fallback auth path.
        normalized = (value or "").strip().lower()
        if normalized not in VALID_AUTH_MODES:
            raise ValueError(f"AUTH_MODE must be one of {sorted(VALID_AUTH_MODES)}, got {value!r}")
        return normalized

    entra_tenant_id: str | None = None
    entra_client_id: str | None = None
    entra_authority: str | None = None
    entra_issuer: str | None = None
    entra_audience: str | None = None
    entra_jwks_url: str | None = None
    entra_finance_group_id: str | None = None
    entra_billing_group_id: str | None = None
    entra_system_admin_group_id: str | None = None

    @property
    def is_entra_auth_mode(self) -> bool:
        return (self.auth_mode or "").strip().lower() == "entra"


settings = Settings()
