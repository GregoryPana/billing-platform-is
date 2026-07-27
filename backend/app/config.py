from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env.local", ".env"), env_file_encoding="utf-8")

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
