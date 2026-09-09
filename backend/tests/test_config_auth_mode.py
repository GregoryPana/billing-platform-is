import pytest
from pydantic import ValidationError

from app.config import Settings


def test_auth_mode_accepts_local():
    assert Settings(auth_mode="local").auth_mode == "local"


def test_auth_mode_accepts_entra():
    assert Settings(auth_mode="entra").auth_mode == "entra"


def test_auth_mode_normalizes_case_and_whitespace():
    assert Settings(auth_mode=" Entra ").auth_mode == "entra"


def test_production_accepts_only_normalized_entra_mode():
    settings = Settings(environment=" Production ", auth_mode=" EnTrA ")
    assert settings.auth_mode == "entra"


@pytest.mark.parametrize("environment", ["production", "PRODUCTION", " production "])
def test_production_rejects_explicit_local_auth_mode(environment):
    with pytest.raises(ValidationError, match="AUTH_MODE must be 'entra'"):
        Settings(environment=environment, auth_mode="local")


def test_production_rejects_missing_auth_mode_default(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("AUTH_MODE", raising=False)
    with pytest.raises(ValidationError, match="AUTH_MODE must be 'entra'"):
        Settings(environment="production")


@pytest.mark.parametrize("environment", ["local", "development", "test"])
def test_nonproduction_environments_keep_local_auth_default(environment):
    assert Settings(environment=environment).auth_mode == "local"


@pytest.mark.parametrize("bad_value", ["", "prod", "Entraid", "true", "1", "none"])
def test_auth_mode_rejects_invalid_values_at_construction(bad_value):
    # An invalid AUTH_MODE must crash Settings construction (i.e. app
    # startup), never silently fall back to "local" or any other mode.
    with pytest.raises(ValidationError):
        Settings(auth_mode=bad_value)
