import smtplib
from email.message import EmailMessage

import requests

from app.config import settings


def send_notification(channel: str, recipient: str, subject: str, message: str) -> tuple[bool, str]:
    if channel == "n8n":
        return _send_n8n(recipient, subject, message)
    if channel == "smtp":
        return _send_smtp(recipient, subject, message)
    return False, "Unsupported notification channel"


def _send_n8n(recipient: str, subject: str, message: str) -> tuple[bool, str]:
    if not settings.n8n_webhook_url:
        return False, "n8n webhook url not configured"
    response = requests.post(
        settings.n8n_webhook_url,
        json={
            "recipient": recipient,
            "subject": subject,
            "message": message,
        },
        timeout=10,
    )
    if response.ok:
        return True, "sent"
    return False, f"n8n error: {response.status_code}"


def _send_smtp(recipient: str, subject: str, message: str) -> tuple[bool, str]:
    if not settings.smtp_enabled:
        return False, "smtp disabled"
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password, settings.smtp_from]):
        return False, "smtp configuration incomplete"

    email_message = EmailMessage()
    email_message["From"] = settings.smtp_from
    email_message["To"] = recipient
    email_message["Subject"] = subject
    email_message.set_content(message)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(email_message)

    return True, "sent"
