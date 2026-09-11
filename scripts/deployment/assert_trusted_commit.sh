#!/usr/bin/env bash
set -euo pipefail

resolved_sha="${1:-}"
repo="${2:-.}"

if [[ ! "$resolved_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Resolved commit must be a full 40-character lowercase SHA" >&2
  exit 2
fi

git -C "$repo" fetch --no-tags origin \
  +refs/heads/main:refs/remotes/origin/main

if ! git -C "$repo" cat-file -e "${resolved_sha}^{commit}" 2>/dev/null; then
  echo "Resolved SHA is not a commit in this repository: ${resolved_sha}" >&2
  exit 1
fi

if ! git -C "$repo" merge-base --is-ancestor "$resolved_sha" origin/main; then
  echo "Resolved SHA is not reachable from trusted origin/main: ${resolved_sha}" >&2
  exit 1
fi

printf '%s\n' "$resolved_sha"