#!/usr/bin/env bash
# Proves the ci.yml step composition guarantee: when
# validate-required-env.sh fails, a chained mutation step (standing in for
# "Sync repo to /opt/billing") never runs and a temporary deploy target is
# left completely untouched. This mirrors GitHub Actions' own semantics -
# a non-zero exit from one `run:` step stops the job before the next step
# executes - without needing a live runner or real /opt/billing.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
validate_script="${script_dir}/validate-required-env.sh"

fail=0

check() {
  if [[ "$1" == "0" ]]; then
    echo "ok - $2"
  else
    echo "FAIL - $2"
    fail=1
  fi
}

# --- Case 1: a required setting is missing -> preflight fails, target untouched ---
target_dir="$(mktemp -d)"
trap 'rm -rf "$target_dir"' EXIT
echo "pre-existing sentinel" > "${target_dir}/sentinel.txt"
before_listing="$(find "$target_dir" -type f -printf '%f %s\n' | sort)"

unset BILLING_DATABASE_URL BILLING_JWT_SECRET
export BILLING_DATABASE_URL=""
export BILLING_JWT_SECRET="present"

set +e
bash "$validate_script" BILLING_DATABASE_URL BILLING_JWT_SECRET
validate_exit=$?
if [[ $validate_exit -eq 0 ]]; then
  echo "mutated: touched by preflight" > "${target_dir}/mutated.txt"
fi
set -e

check "$([[ $validate_exit -ne 0 ]] && echo 0 || echo 1)" "missing required setting fails preflight (exit ${validate_exit})"

after_listing="$(find "$target_dir" -type f -printf '%f %s\n' | sort)"
check "$([[ "$before_listing" == "$after_listing" ]] && echo 0 || echo 1)" "target directory is byte-for-byte unchanged after a failed preflight"
check "$([[ ! -f "${target_dir}/mutated.txt" ]] && echo 0 || echo 1)" "mutation step never ran"

# --- Case 2: all required settings present -> preflight succeeds ---
export BILLING_DATABASE_URL="postgresql+psycopg://u:p@host/db"
export BILLING_JWT_SECRET="present"
set +e
bash "$validate_script" BILLING_DATABASE_URL BILLING_JWT_SECRET
validate_exit=$?
set -e
check "$([[ $validate_exit -eq 0 ]] && echo 0 || echo 1)" "all required settings present passes preflight"

# --- Case 3: preflight never echoes the secret value itself ---
export BILLING_DATABASE_URL=""
export BILLING_JWT_SECRET="super-secret-value-must-not-leak"
set +e
output="$(bash "$validate_script" BILLING_DATABASE_URL BILLING_JWT_SECRET 2>&1)"
set -e
check "$([[ "$output" != *"super-secret-value-must-not-leak"* ]] && echo 0 || echo 1)" "preflight failure output never contains a secret value"

if [[ "$fail" -ne 0 ]]; then
  echo "One or more preflight-isolation checks failed" >&2
  exit 1
fi
echo "All preflight-isolation checks passed."
