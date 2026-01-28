from app.schemas.base import BaseSchema


class ApprovalSettingsRead(BaseSchema):
    billing_email: str
    default_message: str
    finance_recipients: list[str]


class ApprovalSettingsUpdate(BaseSchema):
    billing_email: str | None = None
    default_message: str | None = None
    finance_recipients: list[str] | None = None
