from datetime import datetime, timedelta, timezone

from app.config import settings


def utc_plus_4_now() -> datetime:
    offset = timedelta(hours=settings.timezone_offset_hours)
    return datetime.now(timezone.utc).astimezone(timezone(offset))


def next_month_str(month: str) -> str:
    """Given "YYYY-MM", return the following month as "YYYY-MM"."""
    year, month_number = (int(part) for part in month.split("-"))
    if month_number == 12:
        return f"{year + 1}-01"
    return f"{year}-{month_number + 1:02d}"
