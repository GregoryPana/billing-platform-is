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
    cors_allowed_origins: list[str] = ["http://localhost:5173"]
    frontend_url: str = "http://localhost:5173"
    session_cookie_name: str = "billing_session"
    session_secret: str = "change-me-session-secret"
    session_exp_minutes: int = 60
    entra_client_id: str = ""
    entra_client_secret: str = ""
    entra_redirect_uri: str = ""
    entra_authority: str = "https://login.microsoftonline.com/common"


settings = Settings()
