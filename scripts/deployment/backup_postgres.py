"""Create and validate a PostgreSQL custom-format pre-migration backup.

Fail-closed: any parse error, pg_dump/pg_restore failure, or empty dump
leaves no backup file behind and exits non-zero, which must stop the
calling deploy job before alembic upgrade head runs.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit

# libpq environment variables read by pg_dump/pg_restore for TLS and
# connection tuning. Only forwarded when present in DATABASE_URL's query
# string; anything else in the query string is ignored.
PG_QUERY_ENV = {
    "sslmode": "PGSSLMODE",
    "sslcert": "PGSSLCERT",
    "sslkey": "PGSSLKEY",
    "sslrootcert": "PGSSLROOTCERT",
    "sslcrl": "PGSSLCRL",
    "sslcompression": "PGSSLCOMPRESSION",
    "connect_timeout": "PGCONNECT_TIMEOUT",
    "application_name": "PGAPPNAME",
    "options": "PGOPTIONS",
}


def connection_environment(database_url: str) -> dict[str, str]:
    """Translate a SQLAlchemy-style DATABASE_URL into libpq env vars.

    Handles the `postgresql+psycopg://` driver-suffixed scheme this repo's
    DATABASE_URL actually uses, not just a bare `postgresql://` scheme.
    """
    parsed = urlsplit(database_url)
    scheme = parsed.scheme.split("+", 1)[0]
    if scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use a PostgreSQL scheme")
    if not parsed.hostname:
        raise ValueError("DATABASE_URL must include a database host")

    database = unquote(parsed.path.lstrip("/"))
    if not database:
        raise ValueError("DATABASE_URL must include a database name")

    env = os.environ.copy()
    env.update(
        {
            "PGHOST": parsed.hostname,
            "PGPORT": str(parsed.port or 5432),
            "PGDATABASE": database,
        }
    )
    if parsed.username is not None:
        env["PGUSER"] = unquote(parsed.username)
    if parsed.password is not None:
        env["PGPASSWORD"] = unquote(parsed.password)

    for key, value in parse_qsl(parsed.query, keep_blank_values=False):
        target = PG_QUERY_ENV.get(key.lower())
        if target:
            env[target] = value
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("DATABASE_URL is required for the backup gate", file=sys.stderr)
        return 2

    safe_revision = re.sub(r"[^A-Za-z0-9_.-]", "-", args.revision).strip("-") or "unknown"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    destination = args.output_dir / f"billing-pre-migration-{timestamp}-{safe_revision}.dump"

    temporary: Path | None = None
    try:
        pg_env = connection_environment(database_url)
        with tempfile.NamedTemporaryFile(
            dir=args.output_dir, prefix=".billing-backup-", suffix=".tmp", delete=False
        ) as handle:
            temporary = Path(handle.name)
        temporary.chmod(0o600)
        subprocess.run(
            [
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "--no-privileges",
                f"--file={temporary}",
            ],
            env=pg_env,
            check=True,
        )
        if temporary.stat().st_size == 0:
            raise RuntimeError("pg_dump produced an empty backup")
        # Confirms the dump is a structurally valid custom-format archive
        # before it is trusted as a restore point. Output is discarded, not
        # inspected, so no schema/data content is echoed to the log.
        subprocess.run(["pg_restore", "--list", str(temporary)], check=True, stdout=subprocess.DEVNULL)
        temporary.replace(destination)
        destination.chmod(0o600)
    except (OSError, subprocess.CalledProcessError, RuntimeError, ValueError) as exc:
        print(f"Pre-migration PostgreSQL backup failed: {exc}", file=sys.stderr)
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        return 1

    print(f"Validated pre-migration backup: {destination}")
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as output:
            output.write(f"backup_path={destination}\n")
            output.write(f"backup_created_at={timestamp}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
