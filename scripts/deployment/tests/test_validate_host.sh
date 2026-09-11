#!/usr/bin/env bash
# Exercises scripts/deployment/validate-host.sh success and failure paths
# using a disposable fake bin dir, marker file, and deploy root - no real
# host or systemd required.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
validate_script="${script_dir}/validate-host.sh"

work_dir="$(mktemp -d)"
fail=0
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT

check() {
  if [[ "$1" == "0" ]]; then
    echo "ok - $2"
  else
    echo "FAIL - $2"
    fail=1
  fi
}

make_fake_bin_dir_with_all_tools() {
  local dir="$1"
  mkdir -p "$dir"
  for bin in rsync python3 node npm pg_dump pg_restore systemctl; do
    cat > "${dir}/${bin}" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "list-unit-files" ]]; then
  echo "billing-api.service enabled"
  exit 0
fi
if [[ "${1:-}" == "show" ]]; then
  echo "billing"
  exit 0
fi
exit 0
EOF
    chmod +x "${dir}/${bin}"
  done
}

setup_case() {
  local case_dir="$1"
  mkdir -p "${case_dir}/parent/opt-billing-parent"
  echo "billing-production" > "${case_dir}/marker"
}

# --- Case 1: everything present and matching -> succeeds ---
case_dir="${work_dir}/case1"
setup_case "$case_dir"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script"
exit_code=$?
set -e
check "$([[ $exit_code -eq 0 ]] && echo 0 || echo 1)" "all checks pass on a fully valid host"

# --- Case 2: missing marker file -> fails closed ---
case_dir="${work_dir}/case2"
setup_case "$case_dir"
rm -f "${case_dir}/marker"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "missing host marker fails closed"

# --- Case 3: marker content mismatch -> fails closed ---
case_dir="${work_dir}/case3"
setup_case "$case_dir"
echo "some-other-host" > "${case_dir}/marker"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "mismatched host marker fails closed"

# --- Case 4: missing required binary -> fails closed ---
case_dir="${work_dir}/case4"
setup_case "$case_dir"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"
rm -f "${bin_dir}/pg_dump"
# Isolate PATH so a pg_dump installed on the CI host cannot satisfy the check.
# Keep only the shell utilities needed to execute the validator and its mocks.
ln -s /bin/bash "${bin_dir}/bash"
ln -s /usr/bin/dirname "${bin_dir}/dirname"
ln -s /usr/bin/grep "${bin_dir}/grep"

set +e
PATH="$bin_dir" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  /bin/bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "missing required binary fails closed"

# --- Case 5: missing systemd unit -> fails closed ---
case_dir="${work_dir}/case5"
setup_case "$case_dir"
bin_dir="${case_dir}/bin"
mkdir -p "$bin_dir"
for bin in rsync python3 node npm pg_dump pg_restore; do
  cat > "${bin_dir}/${bin}" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "${bin_dir}/${bin}"
done
cat > "${bin_dir}/systemctl" <<'EOF'
#!/usr/bin/env bash
echo ""
exit 0
EOF
chmod +x "${bin_dir}/systemctl"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "missing systemd unit fails closed"

# --- Case 6: non-writable deploy root parent -> fails closed ---
case_dir="${work_dir}/case6"
setup_case "$case_dir"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/does-not-exist-at-all/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "non-existent deploy root parent fails closed"

# --- Case 7: unmanaged legacy deployment directory -> fails before mutation ---
case_dir="${work_dir}/case7"
setup_case "$case_dir"
mkdir -p "${case_dir}/parent/opt-billing-parent/billing/backend"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "unmanaged legacy layout fails closed"

# --- Case 8: a symlink outside the managed topology fails closed ---
case_dir="${work_dir}/case8"
setup_case "$case_dir"
deploy_root="${case_dir}/parent/opt-billing-parent/billing"
mkdir -p "$deploy_root"
ln -s ../../outside "$deploy_root/current"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="$deploy_root" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "unmanaged current symlink target fails closed"

# --- Case 9: a root-running API service fails closed ---
case_dir="${work_dir}/case9"
setup_case "$case_dir"
bin_dir="${case_dir}/bin"
make_fake_bin_dir_with_all_tools "$bin_dir"
cat > "${bin_dir}/systemctl" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "list-unit-files" ]]; then
  echo "billing-api.service enabled"
elif [[ "${1:-}" == "show" ]]; then
  echo "root"
fi
exit 0
EOF
chmod +x "${bin_dir}/systemctl"

set +e
PATH="${bin_dir}:${PATH}" \
  HOST_MARKER_FILE="${case_dir}/marker" \
  EXPECTED_HOST_MARKER="billing-production" \
  DEPLOY_ROOT="${case_dir}/parent/opt-billing-parent/billing" \
  SERVICE_NAME=billing-api \
  EXPECTED_SERVICE_USER=billing \
  bash "$validate_script" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "root-running API service fails closed"

if [[ "$fail" -ne 0 ]]; then
  echo "One or more validate-host checks failed" >&2
  exit 1
fi
echo "All validate-host checks passed."
