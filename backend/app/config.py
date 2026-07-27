from pydantic_settings import BaseSettings, SettingsConfigDict


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
    entra_enabled: bool = False
    entra_tenant_id: str | None = None
    entra_client_id: str | None = None
    entra_authority: str | None = None
    entra_issuer: str | None = None
    entra_audience: str | None = None
    entra_jwks_url: str | None = None
    entra_finance_group_id: str | None = None
    entra_billing_group_id: str | None = None
    entra_system_admin_group_id: str | None = None


settings = Settings()
