#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git init --bare "$tmp/origin.git" >/dev/null
git init -b main "$tmp/source" >/dev/null
git -C "$tmp/source" config user.email test@example.invalid
git -C "$tmp/source" config user.name Test
printf 'trusted\n' > "$tmp/source/file"
git -C "$tmp/source" add file
git -C "$tmp/source" commit -m trusted >/dev/null
trusted_sha="$(git -C "$tmp/source" rev-parse HEAD)"
git -C "$tmp/source" remote add origin "$tmp/origin.git"
git -C "$tmp/source" push -u origin main >/dev/null

git clone "$tmp/origin.git" "$tmp/work" >/dev/null 2>&1
bash "$SCRIPT_DIR/assert_trusted_commit.sh" "$trusted_sha" "$tmp/work" >/dev/null

git -C "$tmp/source" switch -c unmerged >/dev/null
printf 'untrusted\n' >> "$tmp/source/file"
git -C "$tmp/source" commit -am unmerged >/dev/null
untrusted_sha="$(git -C "$tmp/source" rev-parse HEAD)"
git -C "$tmp/source" push origin unmerged >/dev/null
git -C "$tmp/work" fetch origin unmerged >/dev/null

if bash "$SCRIPT_DIR/assert_trusted_commit.sh" "$untrusted_sha" "$tmp/work" >/dev/null 2>&1; then
  echo "FAIL: unmerged commit was accepted" >&2
  exit 1
fi

if bash "$SCRIPT_DIR/assert_trusted_commit.sh" not-a-sha "$tmp/work" >/dev/null 2>&1; then
  echo "FAIL: malformed SHA was accepted" >&2
  exit 1
fi

echo "PASS: only commits reachable from origin/main are trusted"