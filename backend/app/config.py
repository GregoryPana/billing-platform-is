from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env.local", ".env"), env_file_encoding="utf-8")

    app_name: str = "Billing Platform API"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://billing:billing@localhost:5432/billing"
    timezone_offset_hours: int = 4
    n8n_webhook_url: str | None = None
    n8n_approval_webhook_url: str | None = None
    n8n_signup_webhook_url: str | None = None
    n8n_signup_approve_webhook_url: str | None = None
    n8n_webhook_verify: bool = True
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 480


settings = Settings()
