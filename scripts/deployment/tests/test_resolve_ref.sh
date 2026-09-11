#!/usr/bin/env bash
# Exercises scripts/deployment/resolve_ref.sh against a disposable local
# git repository - no network access or the real repository required.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve_script="${script_dir}/resolve_ref.sh"

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

repo="${work_dir}/repo"
mkdir -p "$repo"
# -b main pins the initial branch name explicitly so this test does not
# depend on the environment's init.defaultBranch (which may be "master").
git -C "$repo" init -q -b main
git -C "$repo" config user.email "test@example.com"
git -C "$repo" config user.name "test"

echo "one" > "${repo}/file.txt"
git -C "$repo" add file.txt
git -C "$repo" commit -q -m "first"
first_sha="$(git -C "$repo" rev-parse HEAD)"

echo "two" > "${repo}/file.txt"
git -C "$repo" add file.txt
git -C "$repo" commit -q -m "second"
second_sha="$(git -C "$repo" rev-parse HEAD)"

git -C "$repo" branch feature-branch "$first_sha"
git -C "$repo" tag v1.0.0 "$first_sha"

# --- Case 1: branch name resolves to its exact commit SHA ---
set +e
resolved="$(bash "$resolve_script" main "$repo")"
exit_code=$?
set -e
check "$([[ $exit_code -eq 0 ]] && echo 0 || echo 1)" "resolving 'main' succeeds"
check "$([[ "$resolved" == "$second_sha" ]] && echo 0 || echo 1)" "'main' resolves to the tip commit"
check "$([[ "$resolved" =~ ^[0-9a-f]{40}$ ]] && echo 0 || echo 1)" "resolved value is a full 40-char SHA"

# --- Case 2: tag name resolves correctly ---
resolved="$(bash "$resolve_script" v1.0.0 "$repo")"
check "$([[ "$resolved" == "$first_sha" ]] && echo 0 || echo 1)" "tag resolves to the tagged commit"

# --- Case 3: other branch name resolves correctly ---
resolved="$(bash "$resolve_script" feature-branch "$repo")"
check "$([[ "$resolved" == "$first_sha" ]] && echo 0 || echo 1)" "feature branch resolves to its own commit"

# --- Case 4: short SHA resolves to the full SHA ---
short_sha="${second_sha:0:10}"
resolved="$(bash "$resolve_script" "$short_sha" "$repo")"
check "$([[ "$resolved" == "$second_sha" ]] && echo 0 || echo 1)" "short SHA resolves to full SHA"

# --- Case 5: full SHA input round-trips unchanged ---
resolved="$(bash "$resolve_script" "$second_sha" "$repo")"
check "$([[ "$resolved" == "$second_sha" ]] && echo 0 || echo 1)" "full SHA input round-trips"

# --- Case 6: unknown ref fails closed ---
set +e
bash "$resolve_script" does-not-exist "$repo" >/dev/null 2>&1
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "unknown ref fails closed (exit ${exit_code})"

# --- Case 7: an ambiguous ref name (tag and branch share a name) fails closed ---
git -C "$repo" branch ambiguous-name "$second_sha"
git -C "$repo" tag ambiguous-name "$first_sha"
set +e
output="$(bash "$resolve_script" ambiguous-name "$repo" 2>&1)"
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "ambiguous ref name fails closed (exit ${exit_code})"
check "$([[ "$output" == *ambiguous* ]] && echo 0 || echo 1)" "ambiguous ref failure message mentions ambiguity"

# --- Case 8: empty ref fails closed with usage error, no output ---
set +e
bash "$resolve_script" "" "$repo" >/dev/null 2>&1
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "empty ref fails closed (exit ${exit_code})"

if [[ "$fail" -ne 0 ]]; then
  echo "One or more resolve_ref checks failed" >&2
  exit 1
fi
echo "All resolve_ref checks passed."
