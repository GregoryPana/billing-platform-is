#!/usr/bin/env bash
# Exercises scripts/deployment/release_manager.sh's activate/prune commands
# against a disposable fake deploy root - no real /opt/billing required.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_script="${script_dir}/release_manager.sh"

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

make_release() {
  local root="$1" sha="$2" complete="$3"
  mkdir -p "${root}/releases/${sha}/backend" "${root}/releases/${sha}/frontend"
  echo "backend for ${sha}" > "${root}/releases/${sha}/backend/marker.txt"
  if [[ "$complete" == "yes" ]]; then
    touch "${root}/releases/${sha}/.deploy-complete"
  fi
}

# --- Case 1: activating a release without a completion marker fails closed ---
root="${work_dir}/root1"
mkdir -p "$root"
incomplete_sha="$(printf '%040x' 10)"
make_release "$root" "$incomplete_sha" "no"

set +e
bash "$release_script" activate "$root" "$incomplete_sha" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "activating an incomplete release fails closed"
check "$([[ ! -e "${root}/current" ]] && echo 0 || echo 1)" "current pointer not created for an incomplete release"

# --- Case 2: activating a non-existent release fails closed ---
root="${work_dir}/root2"
mkdir -p "$root"
missing_sha="$(printf '%040x' 11)"
set +e
bash "$release_script" activate "$root" "$missing_sha" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "activating a missing release directory fails closed"

# --- Case 2b: legacy directories must be migrated out-of-band; activation
# fails before changing current rather than partly replacing the live layout.
root="${work_dir}/root2b"
mkdir -p "$root/backend"
legacy_sha="$(printf '%040x' 12)"
make_release "$root" "$legacy_sha" "yes"
set +e
bash "$release_script" activate "$root" "$legacy_sha" 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "activation refuses an unmanaged legacy directory"
check "$([[ ! -e "${root}/current" ]] && echo 0 || echo 1)" "legacy-layout rejection leaves current untouched"

# --- Case 3: activating a complete release creates current/backend/frontend symlinks ---
root="${work_dir}/root3"
mkdir -p "$root"
sha1="$(printf '%040x' 26)"
make_release "$root" "$sha1" "yes"

bash "$release_script" activate "$root" "$sha1"
check "$([[ -L "${root}/current" ]] && echo 0 || echo 1)" "current is a symlink after activation"
check "$([[ "$(readlink "${root}/current")" == "releases/${sha1}" ]] && echo 0 || echo 1)" "current points at the activated release"
check "$([[ -L "${root}/backend" ]] && echo 0 || echo 1)" "backend is a symlink after activation"
check "$([[ "$(cat "${root}/backend/marker.txt")" == "backend for ${sha1}" ]] && echo 0 || echo 1)" "backend symlink resolves into the activated release"

# --- Case 4: activating a second release atomically switches all pointers,
# and records the previous target for rollback evidence ---
sha2="$(printf '%040x' 43)"
make_release "$root" "$sha2" "yes"
bash "$release_script" activate "$root" "$sha2"
check "$([[ "$(readlink "${root}/current")" == "releases/${sha2}" ]] && echo 0 || echo 1)" "current switches to the newly activated release"
check "$([[ "$(cat "${root}/backend/marker.txt")" == "backend for ${sha2}" ]] && echo 0 || echo 1)" "backend symlink resolves into the newly activated release"
check "$([[ -f "${root}/previous-release.txt" ]] && echo 0 || echo 1)" "previous-release.txt is written on switch"
check "$([[ "$(cat "${root}/previous-release.txt")" == "releases/${sha1}" ]] && echo 0 || echo 1)" "previous-release.txt names the displaced release"

# --- Case 5: prune keeps the active release and the N most recent, deletes the rest ---
root="${work_dir}/root5"
mkdir -p "$root"
shas=()
for i in 1 2 3 4 5; do
  sha="$(printf '%040d' "$i")"
  make_release "$root" "$sha" "yes"
  shas+=("$sha")
  sleep 0.05
done
bash "$release_script" activate "$root" "${shas[0]}"

bash "$release_script" prune "$root" 2
shopt -s nullglob
remaining_releases=("${root}/releases"/*)
remaining_count="${#remaining_releases[@]}"
check "$([[ "$remaining_count" -eq 3 ]] && echo 0 || echo 1)" "prune keeps the active release plus 2 most recent (found ${remaining_count})"
check "$([[ -d "${root}/releases/${shas[0]}" ]] && echo 0 || echo 1)" "prune never removes the active release even though it is oldest"
check "$([[ -d "${root}/releases/${shas[4]}" ]] && echo 0 || echo 1)" "prune keeps the most recent release"
check "$([[ -d "${root}/releases/${shas[3]}" ]] && echo 0 || echo 1)" "prune keeps the second most recent release"
check "$([[ ! -d "${root}/releases/${shas[1]}" ]] && echo 0 || echo 1)" "prune removes an old, non-active release"

# --- Case 6: prune refuses unexpected entries before deleting anything ---
root="${work_dir}/root6"
mkdir -p "$root"
make_release "$root" "$sha1" "yes"
mkdir "${root}/releases/not-a-release"
set +e
bash "$release_script" prune "$root" 0 2>/dev/null
exit_code=$?
set -e
check "$([[ $exit_code -ne 0 ]] && echo 0 || echo 1)" "prune rejects non-SHA entries"
check "$([[ -d "${root}/releases/${sha1}" ]] && echo 0 || echo 1)" "failed prune leaves valid releases untouched"

if [[ "$fail" -ne 0 ]]; then
  echo "One or more release_manager checks failed" >&2
  exit 1
fi
echo "All release_manager checks passed."
