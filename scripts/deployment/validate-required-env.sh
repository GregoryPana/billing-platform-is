#!/usr/bin/env bash
# Fail-closed presence check for deployment settings. Performs no writes.
# Reports only which names are missing - never the values - so this script
# is safe to run before any mutation under a deploy target directory.
set -euo pipefail

if (( $# == 0 )); then
  echo "usage: $0 VARIABLE [VARIABLE ...]" >&2
  exit 2
fi

missing=0
for name in "$@"; do
  if [[ ! "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    echo "Invalid environment variable name: ${name}" >&2
    exit 2
  fi
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment setting: ${name}" >&2
    missing=1
  fi
done

if (( missing != 0 )); then
  echo "Required deployment settings are incomplete; no deployment files have been changed." >&2
  exit 1
fi

echo "All required deployment settings are present."
