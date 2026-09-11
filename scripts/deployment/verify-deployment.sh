#!/usr/bin/env bash
# Three-proof post-restart verification:
#   1. recent service restart   - a strictly newer systemd process-start
#      marker than the value captured immediately before the restart
#   2. exact migration revision - the database's single current head equals
#      the resolved deployment head, not merely "a command ran"
#      (skipped, not asserted, when SKIP_MIGRATION_CHECK=1 - used by
#      rollback, which never touches the database; the current revision is
#      still recorded for evidence)
#   3. HTTP application readiness - a real 200 response with the exact
#      expected body, not just "the process is active"
# Any required proof that is missing fails closed (non-zero exit, no proof
# file written).
set -euo pipefail

service_name="${SERVICE_NAME:?SERVICE_NAME is required}"
previous_start="${PREVIOUS_START_MONOTONIC:?PREVIOUS_START_MONOTONIC is required}"
expected_revision="${EXPECTED_MIGRATION_REVISION:?EXPECTED_MIGRATION_REVISION is required}"
readiness_url="${READINESS_URL:?READINESS_URL is required}"
proof_file="${PROOF_FILE:?PROOF_FILE is required}"
backend_dir="${BACKEND_DIR:?BACKEND_DIR is required}"
skip_migration_check="${SKIP_MIGRATION_CHECK:-0}"
# Overridable only for fast local/CI test harnesses; production always gets
# the ~60s default (30 attempts * 2s) for each polled proof.
poll_attempts="${VERIFY_POLL_ATTEMPTS:-30}"
poll_sleep_seconds="${VERIFY_POLL_SLEEP_SECONDS:-2}"

[[ "$previous_start" =~ ^[0-9]+$ ]] || { echo "Invalid previous service start marker" >&2; exit 2; }
[[ "$expected_revision" =~ ^[0-9A-Za-z]+$ ]] || { echo "Invalid expected migration revision" >&2; exit 2; }

# --- Proof 1: recent service restart ---
current_start=""
for (( attempt = 0; attempt < poll_attempts; attempt++ )); do
  current_start="$(systemctl show "$service_name" --property=ExecMainStartTimestampMonotonic --value)"
  if [[ "$current_start" =~ ^[0-9]+$ ]] && (( current_start > previous_start )); then
    break
  fi
  sleep "$poll_sleep_seconds"
done
if [[ ! "$current_start" =~ ^[0-9]+$ ]] || (( current_start <= previous_start )); then
  echo "Service did not prove a new process start after restart" >&2
  exit 1
fi

# --- Proof 2: migration revision ---
mapfile -t current_revisions < <(
  cd "$backend_dir"
  ./.venv/bin/alembic current | awk '/^[[:xdigit:]]+[[:space:]]/{print $1}'
)
migration_status="skipped"
if (( skip_migration_check == 0 )); then
  if (( ${#current_revisions[@]} != 1 )) || [[ "${current_revisions[0]}" != "$expected_revision" ]]; then
    echo "Database revision does not exactly match the deployment head" >&2
    exit 1
  fi
  migration_status="verified"
fi
observed_revision="${current_revisions[0]:-unknown}"

# --- Proof 3: HTTP application readiness ---
readiness_verified=0
for (( attempt = 0; attempt < poll_attempts; attempt++ )); do
  if python3 - "$readiness_url" <<'PY'
import json
import sys
from urllib.request import urlopen

try:
    with urlopen(sys.argv[1], timeout=2) as response:
        payload = json.load(response)
        if response.status == 200 and payload == {"status": "ok"}:
            raise SystemExit(0)
except Exception:
    pass
raise SystemExit(1)
PY
  then
    readiness_verified=1
    break
  fi
  sleep "$poll_sleep_seconds"
done
if (( readiness_verified != 1 )); then
  echo "HTTP readiness did not return the expected application response" >&2
  exit 1
fi

{
  echo "recent_service_restart=verified"
  echo "service_start_monotonic=${current_start}"
  echo "migration_revision_check=${migration_status}"
  echo "observed_migration_revision=${observed_revision}"
  echo "http_readiness=verified"
  echo "readiness_url=${readiness_url}"
} > "$proof_file"

echo "Verified recent restart, HTTP application readiness, and migration revision (${migration_status})."
