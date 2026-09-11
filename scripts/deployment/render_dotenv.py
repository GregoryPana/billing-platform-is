"""Serialize key/value pairs into `.env` file content, format-correctly.

Every value is wrapped in double quotes with backslashes and double quotes
escaped, so it round-trips exactly through both parsers that read the files
this script's callers write: python-dotenv (via pydantic-settings, for
backend/.env) and Vite's dotenv-expand-based env loader (for
frontend/.env.production). Values containing a newline, carriage return, or
NUL byte are refused outright (fail-closed) rather than written, because
systemd's `EnvironmentFile=` - which also reads backend/.env directly, not
just through pydantic-settings - does not reliably support multi-line
quoted values across the systemd versions this deploys to.

Values containing a `$` are refused outright too, for a separate reason:
both python-dotenv and Vite's dotenv-expand perform `$VAR` / `${VAR}`
interpolation on double-quoted (and unquoted, and - for python-dotenv -
even single-quoted) values, silently rewriting the literal text.
`render_dotenv({"K": "${MISSING}"})` parses back through python-dotenv as
`""`, not the original string, and no backslash escape survives both
parsers intact (python-dotenv leaves a stray backslash, or truncates at
the reference) - see scripts/deployment/tests/test_render_dotenv.py for
the exact reproductions. Since no representation round-trips exactly
across python-dotenv, dotenv-expand, and systemd's EnvironmentFile=
parser simultaneously, any value containing `$` is rejected rather than
risk a silently corrupted secret (e.g. a JWT secret or webhook URL that
happens to contain a literal `$`).
"""

from __future__ import annotations


class UnsafeEnvValueError(ValueError):
    pass


def render_dotenv_value(value: str) -> str:
    """Escape a single value for safe embedding inside double quotes."""
    if "\n" in value or "\r" in value or "\x00" in value:
        raise UnsafeEnvValueError(
            "value contains a newline, carriage return, or NUL byte, which "
            "cannot be safely round-tripped through both python-dotenv and "
            "systemd's EnvironmentFile= parser"
        )
    if "$" in value:
        raise UnsafeEnvValueError(
            "value contains '$', which python-dotenv and Vite's "
            "dotenv-expand both treat as variable-interpolation syntax "
            "(e.g. '${MISSING}' silently becomes an empty string) and "
            "which cannot be escaped in a form proven to round-trip "
            "identically through python-dotenv, dotenv-expand, and "
            "systemd's EnvironmentFile= parser"
        )
    return value.replace("\\", "\\\\").replace('"', '\\"')


def render_dotenv(values: dict[str, str]) -> str:
    """Render an ordered mapping into `.env` file text, one KEY="value" per line."""
    lines = []
    for key, value in values.items():
        try:
            escaped = render_dotenv_value(value)
        except UnsafeEnvValueError as exc:
            raise UnsafeEnvValueError(f"{key}: {exc}") from exc
        lines.append(f'{key}="{escaped}"\n')
    return "".join(lines)
