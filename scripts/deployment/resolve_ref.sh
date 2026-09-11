#!/usr/bin/env bash
# Resolves a user-supplied ref (branch, tag, or full/short commit SHA) to
# exactly one full 40-character commit SHA. Fails closed on: an unknown
# ref, a short SHA that git cannot uniquely resolve, or a ref name that
# resolves only via git's own ambiguity-warning path (e.g. a tag and a
# branch that share a name). Performs no writes; safe to run before any
# deploy-target mutation. Prints only the resolved SHA on stdout.
set -euo pipefail

ref="${1:?usage: resolve_ref.sh REF [REPO_DIR]}"
repo_dir="${2:-.}"

if [[ -z "$ref" ]]; then
  echo "A ref (branch, tag, or commit SHA) is required" >&2
  exit 2
fi

stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT

if ! resolved="$(git -C "$repo_dir" rev-parse --verify --end-of-options "${ref}^{commit}" 2>"$stderr_file")"; then
  echo "Could not resolve ref '${ref}' to a commit: $(cat "$stderr_file")" >&2
  exit 1
fi

if grep -qi "is ambiguous" "$stderr_file"; then
  echo "Ref '${ref}' is ambiguous and cannot be resolved to a single commit: $(cat "$stderr_file")" >&2
  exit 1
fi

if [[ ! "$resolved" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Resolved value '${resolved}' is not a full commit SHA" >&2
  exit 1
fi

echo "$resolved"
