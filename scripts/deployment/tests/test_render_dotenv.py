"""Tests for scripts/deployment/render_dotenv.py.

Round-trips rendered output through the real python-dotenv parser (the
library pydantic-settings uses to read backend/.env) to prove values
survive intact, not just that the serializer's own escaping "looks right".

Run with: python3 -m pytest scripts/deployment/tests/test_render_dotenv.py
"""

from __future__ import annotations

import importlib.util
import io
from pathlib import Path

import pytest
from dotenv import dotenv_values

MODULE_PATH = Path(__file__).resolve().parents[1] / "render_dotenv.py"
spec = importlib.util.spec_from_file_location("render_dotenv", MODULE_PATH)
render_dotenv_module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(render_dotenv_module)

render_dotenv = render_dotenv_module.render_dotenv
UnsafeEnvValueError = render_dotenv_module.UnsafeEnvValueError


def _parse(content: str) -> dict[str, str | None]:
    return dotenv_values(stream=io.StringIO(content))


@pytest.mark.parametrize(
    "value",
    [
        "plain-value",
        'has a "double quote" in it',
        "trailing backslash\\",
        "backslash-quote combo: \\\"",
        "many quotes: \"\"\"",
        "many backslashes: \\\\\\\\",
        "postgresql://user:p@ss\"word@host:5432/db",
        "has a # hash that must not start a comment",
        "has 'single quotes' too",
        "unicode: héllo wörld 🎉",
        "",
    ],
)
def test_round_trips_through_python_dotenv(value):
    rendered = render_dotenv({"SECRET": value})
    parsed = _parse(rendered)
    assert parsed["SECRET"] == value


def test_multiple_keys_preserve_order_and_each_round_trip():
    values = {
        "APP_NAME": "Billing Platform API",
        "DATABASE_URL": 'postgresql://u:p@ss"word@host/db',
        "JWT_SECRET": "back\\slash\"quote",
    }
    rendered = render_dotenv(values)
    assert list(_parse(rendered).keys()) == list(values.keys())
    parsed = _parse(rendered)
    for key, value in values.items():
        assert parsed[key] == value


@pytest.mark.parametrize(
    "bad_value",
    [
        "line1\nline2",
        "carriage\rreturn",
        "nul\x00byte",
        "$abc",
        "${MISSING}",
        "${abc}",
        "mixed $abc and ${def} forms",
        "trailing dollar$",
        "$$double",
        'has "quotes" and a $var mixed in',
        "back\\slash then $var",
    ],
)
def test_rejects_newline_cr_nul_and_dollar_without_writing_anything(bad_value):
    with pytest.raises(UnsafeEnvValueError):
        render_dotenv({"SECRET": bad_value})


def test_rejection_error_names_the_offending_key():
    with pytest.raises(UnsafeEnvValueError, match="BAD_KEY"):
        render_dotenv({"GOOD_KEY": "fine", "BAD_KEY": "line1\nline2"})


def test_rejection_error_names_the_offending_key_for_dollar_value():
    with pytest.raises(UnsafeEnvValueError, match="BAD_KEY"):
        render_dotenv({"GOOD_KEY": "fine", "BAD_KEY": "${MISSING}"})


def test_partial_dict_with_one_bad_value_raises_before_returning_partial_content():
    # No content should ever be returned when any value is unsafe - callers
    # must not write a partially-rendered .env file.
    with pytest.raises(UnsafeEnvValueError):
        render_dotenv({"FIRST": "ok", "SECOND": "bad\nvalue", "THIRD": "ok"})


def test_partial_dict_with_one_dollar_value_raises_before_returning_partial_content():
    with pytest.raises(UnsafeEnvValueError):
        render_dotenv({"FIRST": "ok", "SECOND": "${MISSING}", "THIRD": "ok"})


def test_dollar_brace_reference_would_silently_corrupt_if_unguarded():
    # Documents *why* render_dotenv_value refuses "$": if a value containing
    # an undefined-reference like "${MISSING}" were quoted and written
    # as-is, python-dotenv - the parser backend/.env is actually read
    # through - resolves the reference against the environment and
    # silently replaces it with an empty string rather than raising or
    # preserving the literal text. This is a regression guard: if the "$"
    # check above is ever removed, this test still documents the exact
    # failure mode that made it necessary.
    quoted = 'SECRET="${MISSING}"\n'
    parsed = _parse(quoted)
    assert parsed["SECRET"] == ""


def test_dollar_forms_are_parsed_inconsistently_if_unguarded():
    # "$VAR" and "${VAR}" are not even handled the same way by
    # python-dotenv when the referenced name is undefined: "$abc" survives
    # as literal text but "${abc}" is dropped to an empty string. That
    # inconsistency - not just the "${MISSING}" -> "" case above - is why
    # there is no reliable escape and the whole value is rejected instead.
    assert _parse('SECRET="$abc"\n')["SECRET"] == "$abc"
    assert _parse('SECRET="${abc}"\n')["SECRET"] == ""


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
