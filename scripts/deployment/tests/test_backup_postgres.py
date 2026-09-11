"""Local/static tests for scripts/deployment/backup_postgres.py.

Run with: python3 -m pytest scripts/deployment/tests/test_backup_postgres.py
No network access or real Postgres/pg_dump binary required - failure paths
are exercised with a stub `pg_dump`/`pg_restore` on PATH.
"""

from __future__ import annotations

import importlib.util
import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parents[1] / "backup_postgres.py"
spec = importlib.util.spec_from_file_location("backup_postgres", MODULE_PATH)
backup_postgres = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(backup_postgres)


# --- connection_environment: DATABASE_URL parsing ---


def test_connection_environment_parses_psycopg_driver_scheme():
    env = backup_postgres.connection_environment(
        "postgresql+psycopg://billing_user:s3cret@dbhost:5433/billing?sslmode=require"
    )
    assert env["PGHOST"] == "dbhost"
    assert env["PGPORT"] == "5433"
    assert env["PGDATABASE"] == "billing"
    assert env["PGUSER"] == "billing_user"
    assert env["PGPASSWORD"] == "s3cret"
    assert env["PGSSLMODE"] == "require"


def test_connection_environment_defaults_port_5432():
    env = backup_postgres.connection_environment("postgresql://user:pw@dbhost/billing")
    assert env["PGPORT"] == "5432"


def test_connection_environment_rejects_non_postgres_scheme():
    with pytest.raises(ValueError):
        backup_postgres.connection_environment("mysql://user:pw@dbhost/billing")


def test_connection_environment_requires_host():
    with pytest.raises(ValueError):
        backup_postgres.connection_environment("postgresql:///billing")


def test_connection_environment_requires_database_name():
    with pytest.raises(ValueError):
        backup_postgres.connection_environment("postgresql://user:pw@dbhost/")


def test_connection_environment_unquotes_percent_encoded_credentials():
    env = backup_postgres.connection_environment(
        "postgresql://us%40er:p%40ss@dbhost/billing"
    )
    assert env["PGUSER"] == "us@er"
    assert env["PGPASSWORD"] == "p@ss"


# --- main(): fail-closed behavior without a real pg_dump/pg_restore ---


def _install_fake_binary(bin_dir: Path, name: str, script: str) -> None:
    path = bin_dir / name
    path.write_text(f"#!/usr/bin/env bash\n{script}\n")
    path.chmod(path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def _run_main(monkeypatch, tmp_path, argv, database_url="postgresql://u:p@localhost/billing"):
    output_dir = tmp_path / "backups"
    github_output = tmp_path / "github_output.txt"
    github_output.write_text("")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "backup_postgres.py",
            "--output-dir",
            str(output_dir),
            "--revision",
            "abc123",
            "--github-output",
            str(github_output),
            *argv,
        ],
    )
    exit_code = backup_postgres.main()
    return exit_code, output_dir, github_output


def test_main_fails_closed_when_database_url_missing(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    output_dir = tmp_path / "backups"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "backup_postgres.py",
            "--output-dir",
            str(output_dir),
            "--revision",
            "abc123",
        ],
    )
    exit_code = backup_postgres.main()
    assert exit_code == 2
    assert not output_dir.exists() or not any(output_dir.glob("*.dump"))


def test_main_fails_closed_when_pg_dump_missing_from_path(monkeypatch, tmp_path):
    monkeypatch.setenv("PATH", str(tmp_path / "empty-bin"))
    (tmp_path / "empty-bin").mkdir()
    exit_code, output_dir, github_output = _run_main(monkeypatch, tmp_path, [])
    assert exit_code == 1
    assert not any(output_dir.glob("*.dump"))
    assert not any(output_dir.iterdir()) if output_dir.exists() else True
    assert "backup_path=" not in github_output.read_text()


def test_main_fails_closed_on_empty_dump(monkeypatch, tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _install_fake_binary(bin_dir, "pg_dump", 'for arg in "$@"; do case "$arg" in --file=*) touch "${arg#--file=}";; esac; done; exit 0')
    _install_fake_binary(bin_dir, "pg_restore", "exit 0")
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")

    exit_code, output_dir, github_output = _run_main(monkeypatch, tmp_path, [])
    assert exit_code == 1
    assert not any(output_dir.glob("*.dump"))
    assert "backup_path=" not in github_output.read_text()


def test_main_fails_closed_when_pg_restore_list_rejects_dump(monkeypatch, tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _install_fake_binary(
        bin_dir,
        "pg_dump",
        'for arg in "$@"; do case "$arg" in --file=*) echo "not-a-real-dump" > "${arg#--file=}";; esac; done; exit 0',
    )
    _install_fake_binary(bin_dir, "pg_restore", "exit 1")
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")

    exit_code, output_dir, github_output = _run_main(monkeypatch, tmp_path, [])
    assert exit_code == 1
    assert not any(output_dir.glob("*.dump"))
    assert "backup_path=" not in github_output.read_text()


def test_main_succeeds_and_redacts_no_credentials(monkeypatch, tmp_path, capsys):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _install_fake_binary(
        bin_dir,
        "pg_dump",
        'for arg in "$@"; do case "$arg" in --file=*) echo "fake-dump-bytes" > "${arg#--file=}";; esac; done; exit 0',
    )
    _install_fake_binary(bin_dir, "pg_restore", "exit 0")
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")

    secret = "s3cret-password-must-not-appear"
    exit_code, output_dir, github_output = _run_main(
        monkeypatch, tmp_path, [], database_url=f"postgresql://user:{secret}@localhost/billing"
    )
    assert exit_code == 0

    dumps = list(output_dir.glob("*.dump"))
    assert len(dumps) == 1
    dump_path = dumps[0]
    assert "abc123" in dump_path.name

    # Restrictive permissions, durable location under output-dir.
    mode = stat.S_IMODE(dump_path.stat().st_mode)
    assert mode == 0o600

    captured = capsys.readouterr()
    assert secret not in captured.out
    assert secret not in captured.err

    github_output_text = github_output.read_text()
    assert secret not in github_output_text
    assert f"backup_path={dump_path}" in github_output_text
    assert "backup_created_at=" in github_output_text


def test_main_rejects_non_postgres_url_without_touching_disk(monkeypatch, tmp_path):
    exit_code, output_dir, github_output = _run_main(
        monkeypatch, tmp_path, [], database_url="mysql://user:pw@localhost/billing"
    )
    assert exit_code == 1
    assert not any(output_dir.glob("*.dump")) if output_dir.exists() else True
    assert "backup_path=" not in github_output.read_text()


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
