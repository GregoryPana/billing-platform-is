from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Billing Platform API"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://billing:billing@localhost:5432/billing"
    timezone_offset_hours: int = 4
    smtp_enabled: bool = False
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    n8n_webhook_url: str | None = None


settings = Settings()
