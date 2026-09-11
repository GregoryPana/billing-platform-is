#!/usr/bin/env bash
# Exercises scripts/deployment/verify-deployment.sh success and failure
# paths using stubbed systemctl/alembic on PATH and a disposable local HTTP
# server for the readiness check - no live billing-api, database, or
# network access required.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
verify_script="${script_dir}/verify-deployment.sh"

work_dir="$(mktemp -d)"
http_port=""
http_pid=""
fail=0

cleanup() {
  [[ -n "$http_pid" ]] && kill "$http_pid" 2>/dev/null || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

check() {
  if [[ "$1" == "0" ]]; then
    echo "ok - $2"
  else
    echo "FAIL - $2"
    fail=1
  fi
}

start_fake_readiness_server() {
  local body="$1"
  local port_file="${work_dir}/port.txt"
  python3 - "$body" "$port_file" > "${work_dir}/server.log" 2>&1 <<'PY' &
import http.server
import json
import sys

body = sys.argv[1]
port_file = sys.argv[2]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        payload = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
with open(port_file, "w") as fh:
    fh.write(str(server.server_port))
server.serve_forever()
PY
  http_pid=$!
  for _ in {1..30}; do
    [[ -s "${work_dir}/port.txt" ]] && break
    sleep 0.1
  done
  http_port="$(cat "${work_dir}/port.txt")"
}

make_fake_bin_dir() {
  local dir="$1"
  local systemctl_start="$2"
  local alembic_revision="$3"
  mkdir -p "$dir"
  cat > "${dir}/systemctl" <<EOF
#!/usr/bin/env bash
echo "${systemctl_start}"
EOF
  chmod +x "${dir}/systemctl"

  mkdir -p "${dir}/backend/.venv/bin"
  cat > "${dir}/backend/.venv/bin/alembic" <<EOF
#!/usr/bin/env bash
echo "${alembic_revision} (head)"
EOF
  chmod +x "${dir}/backend/.venv/bin/alembic"
}

run_verify() {
  local bin_dir="$1"
  PATH="${bin_dir}:${PATH}" VERIFY_POLL_ATTEMPTS=3 VERIFY_POLL_SLEEP_SECONDS=0 bash "$verify_script"
}

# --- Case 1: full success - all three proofs verified ---
start_fake_readiness_server '{"status": "ok"}'
bin_dir="${work_dir}/bin-success"
make_fake_bin_dir "$bin_dir" "200" "abc123def"
proof_file="${work_dir}/proofs-success.txt"

set +e
SERVICE_NAME=billing-api \
  PREVIOUS_START_MONOTONIC=100 \
  EXPECTED_MIGRATION_REVISION=abc123def \
  READINESS_URL="http://127.0.0.1:${http_port}/health" \
  PROOF_FILE="$proof_file" \
  BACKEND_DIR="${bin_dir}/backend" \
  run_verify "$bin_dir"
success_exit=$?
set -e

check "$([[ $success_exit -eq 0 ]] && echo 0 || echo 1)" "all three proofs verified succeeds (exit ${success_exit})"
check "$([[ -f "$proof_file" ]] && echo 0 || echo 1)" "proof file written on success"
if [[ -f "$proof_file" ]]; then
  check "$(grep -q '^recent_service_restart=verified$' "$proof_file" && echo 0 || echo 1)" "proof file records restart"
  check "$(grep -q '^migration_revision_check=verified$' "$proof_file" && echo 0 || echo 1)" "proof file records migration check as verified"
  check "$(grep -q '^observed_migration_revision=abc123def$' "$proof_file" && echo 0 || echo 1)" "proof file records exact revision"
  check "$(grep -q '^http_readiness=verified$' "$proof_file" && echo 0 || echo 1)" "proof file records readiness"
fi
kill "$http_pid" 2>/dev/null || true
http_pid=""

# --- Case 2: restart marker did not advance -> fails, no proof file ---
bin_dir="${work_dir}/bin-stale-restart"
make_fake_bin_dir "$bin_dir" "100" "abc123def"
proof_file="${work_dir}/proofs-stale.txt"

set +e
SERVICE_NAME=billing-api \
  PREVIOUS_START_MONOTONIC=100 \
  EXPECTED_MIGRATION_REVISION=abc123def \
  READINESS_URL="http://127.0.0.1:1/health" \
  PROOF_FILE="$proof_file" \
  BACKEND_DIR="${bin_dir}/backend" \
  run_verify "$bin_dir"
stale_exit=$?
set -e
check "$([[ $stale_exit -ne 0 ]] && echo 0 || echo 1)" "stale restart marker fails closed (exit ${stale_exit})"
check "$([[ ! -f "$proof_file" ]] && echo 0 || echo 1)" "no proof file written when restart is not proven"

# --- Case 3: migration revision mismatch -> fails, no proof file ---
start_fake_readiness_server '{"status": "ok"}'
bin_dir="${work_dir}/bin-bad-revision"
make_fake_bin_dir "$bin_dir" "200" "wrong-revision"
proof_file="${work_dir}/proofs-bad-rev.txt"

set +e
SERVICE_NAME=billing-api \
  PREVIOUS_START_MONOTONIC=100 \
  EXPECTED_MIGRATION_REVISION=abc123def \
  READINESS_URL="http://127.0.0.1:${http_port}/health" \
  PROOF_FILE="$proof_file" \
  BACKEND_DIR="${bin_dir}/backend" \
  run_verify "$bin_dir"
badrev_exit=$?
set -e
check "$([[ $badrev_exit -ne 0 ]] && echo 0 || echo 1)" "migration revision mismatch fails closed (exit ${badrev_exit})"
check "$([[ ! -f "$proof_file" ]] && echo 0 || echo 1)" "no proof file written on revision mismatch"
kill "$http_pid" 2>/dev/null || true
http_pid=""

# --- Case 4: HTTP readiness returns wrong body -> fails, no proof file ---
start_fake_readiness_server '{"status": "starting"}'
bin_dir="${work_dir}/bin-bad-readiness"
make_fake_bin_dir "$bin_dir" "200" "abc123def"
proof_file="${work_dir}/proofs-bad-ready.txt"

set +e
SERVICE_NAME=billing-api \
  PREVIOUS_START_MONOTONIC=100 \
  EXPECTED_MIGRATION_REVISION=abc123def \
  READINESS_URL="http://127.0.0.1:${http_port}/health" \
  PROOF_FILE="$proof_file" \
  BACKEND_DIR="${bin_dir}/backend" \
  run_verify "$bin_dir"
badready_exit=$?
set -e
check "$([[ $badready_exit -ne 0 ]] && echo 0 || echo 1)" "wrong readiness body fails closed (exit ${badready_exit})"
check "$([[ ! -f "$proof_file" ]] && echo 0 || echo 1)" "no proof file written on readiness failure"
kill "$http_pid" 2>/dev/null || true
http_pid=""

# --- Case 5: rollback mode (SKIP_MIGRATION_CHECK=1) succeeds despite a
# migration revision mismatch, and records it as skipped, not verified ---
start_fake_readiness_server '{"status": "ok"}'
bin_dir="${work_dir}/bin-rollback"
# Must be hex, like a real Alembic revision id, so verify-deployment.sh's
# hex-matching parser actually captures it as the observed revision.
make_fake_bin_dir "$bin_dir" "200" "fff000abc999"
proof_file="${work_dir}/proofs-rollback.txt"

set +e
SERVICE_NAME=billing-api \
  PREVIOUS_START_MONOTONIC=100 \
  EXPECTED_MIGRATION_REVISION=abc123def \
  READINESS_URL="http://127.0.0.1:${http_port}/health" \
  PROOF_FILE="$proof_file" \
  BACKEND_DIR="${bin_dir}/backend" \
  SKIP_MIGRATION_CHECK=1 \
  run_verify "$bin_dir"
rollback_exit=$?
set -e
check "$([[ $rollback_exit -eq 0 ]] && echo 0 || echo 1)" "rollback mode ignores migration mismatch (exit ${rollback_exit})"
if [[ -f "$proof_file" ]]; then
  check "$(grep -q '^migration_revision_check=skipped$' "$proof_file" && echo 0 || echo 1)" "proof file records migration check as skipped in rollback mode"
  check "$(grep -q '^observed_migration_revision=fff000abc999$' "$proof_file" && echo 0 || echo 1)" "proof file still records the observed revision for evidence"
else
  check 1 "proof file written in rollback mode"
fi
kill "$http_pid" 2>/dev/null || true
http_pid=""

if [[ "$fail" -ne 0 ]]; then
  echo "One or more verify-deployment checks failed" >&2
  exit 1
fi
echo "All verify-deployment checks passed."
