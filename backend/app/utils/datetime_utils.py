from datetime import datetime, timedelta, timezone

from app.config import settings


def utc_plus_4_now() -> datetime:
    offset = timedelta(hours=settings.timezone_offset_hours)
    return datetime.now(timezone.utc).astimezone(timezone(offset))
