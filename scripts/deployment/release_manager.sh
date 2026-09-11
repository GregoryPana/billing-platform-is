#!/usr/bin/env bash
# Manages the immutable per-SHA release layout under a deploy root:
#   <root>/releases/<sha>/            one immutable checkout+build per SHA
#   <root>/current -> releases/<sha>  atomically swapped active release
#   <root>/backend -> current/backend, <root>/frontend -> current/frontend
#     (kept so the systemd unit's WorkingDirectory/EnvironmentFile and the
#     reverse proxy's paths never have to change)
#   <root>/previous-release.txt       records the release displaced by the
#     most recent activation, so rollback tooling/evidence can name what a
#     rollback is rolling back from
#
# `activate` refuses to switch to a release without `.release-ready` (or the
# later `.deploy-complete` marker). Rollback callers additionally require
# `.deploy-complete`, so a failed first activation is never a rollback target.
set -euo pipefail

atomic_symlink() {
  local target="$1" link_path="$2"
  local tmp_dir
  tmp_dir="$(mktemp -d "${link_path}.tmp.XXXXXX")"
  ln -s "$target" "${tmp_dir}/link"
  mv -T "${tmp_dir}/link" "$link_path"
  rmdir "$tmp_dir"
}

cmd_activate() {
  local root="$1" sha="$2"
  local release_dir="${root}/releases/${sha}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Release identifier must be a full lowercase commit SHA" >&2; return 1; }
  [[ -d "$release_dir" && ! -L "$release_dir" ]] || { echo "Release directory '${release_dir}' does not exist or is a symlink" >&2; return 1; }
  [[ -f "${release_dir}/.release-ready" || -f "${release_dir}/.deploy-complete" ]] || {
    echo "Release '${sha}' is not ready; refusing to activate a partial build" >&2
    return 1
  }

  local path
  for path in current backend frontend; do
    if [[ -e "${root}/${path}" && ! -L "${root}/${path}" ]]; then
      echo "Refusing activation: ${root}/${path} exists and is not a managed symlink" >&2
      return 1
    fi
  done

  local previous_target=""
  if [[ -L "${root}/current" ]]; then
    previous_target="$(readlink "${root}/current")"
    [[ "$previous_target" =~ ^releases/[0-9a-f]{40}$ ]] || {
      echo "Refusing activation: current does not point to a managed release" >&2
      return 1
    }
  fi

  # The compatibility links are stable pointers through `current`; create
  # them once before the activation boundary. On later deployments they are
  # left untouched, so switching `current` is the only live topology change.
  local component expected
  for component in backend frontend; do
    expected="current/${component}"
    if [[ -L "${root}/${component}" && "$(readlink "${root}/${component}")" == "$expected" ]]; then
      continue
    fi
    if [[ -e "${root}/${component}" || -L "${root}/${component}" ]]; then
      echo "Refusing activation: ${root}/${component} is not the managed ${expected} symlink" >&2
      return 1
    fi
    atomic_symlink "$expected" "${root}/${component}"
  done

  # This single rename is the activation boundary for backend and frontend.
  atomic_symlink "releases/${sha}" "${root}/current"

  if [[ -n "$previous_target" ]]; then
    local previous_tmp
    previous_tmp="$(mktemp "${root}/.previous-release.XXXXXX")"
    printf '%s\n' "$previous_target" > "$previous_tmp"
    mv -T "$previous_tmp" "${root}/previous-release.txt"
  fi
  echo "Activated release ${sha}"
}

cmd_prune() {
  local root="$1" keep="$2"
  local releases_dir="${root}/releases"
  [[ "$keep" =~ ^[0-9]+$ ]] || { echo "Retention count must be a non-negative integer" >&2; return 2; }
  [[ -d "$releases_dir" ]] || { echo "No releases directory to prune" >&2; return 0; }

  local active=""
  if [[ -L "${root}/current" ]]; then
    local active_target
    active_target="$(readlink "${root}/current")"
    [[ "$active_target" =~ ^releases/[0-9a-f]{40}$ ]] || { echo "Current is not a managed release; refusing to prune" >&2; return 1; }
    active="${active_target#releases/}"
  fi

  shopt -s nullglob
  local candidate name
  local -a candidates=("${releases_dir}"/*)
  for candidate in "${candidates[@]}"; do
    name="${candidate##*/}"
    if [[ ! "$name" =~ ^[0-9a-f]{40}$ || ! -d "$candidate" || -L "$candidate" ]]; then
      echo "Unexpected entry in releases directory; refusing to prune: ${candidate}" >&2
      return 1
    fi
  done

  mapfile -t all_releases < <(cd "$releases_dir" && ls -1t --)
  local kept=0
  for name in "${all_releases[@]}"; do
    if [[ "$name" == "$active" ]]; then
      continue
    fi
    if (( kept < keep )); then
      kept=$((kept + 1))
      continue
    fi
    rm -rf "${releases_dir:?}/${name:?}"
    echo "Pruned old release ${name}"
  done
}

case "${1:-}" in
  activate)
    [[ $# -eq 3 ]] || { echo "usage: $0 activate DEPLOY_ROOT SHA" >&2; exit 2; }
    cmd_activate "$2" "$3"
    ;;
  prune)
    [[ $# -eq 3 ]] || { echo "usage: $0 prune DEPLOY_ROOT KEEP_COUNT" >&2; exit 2; }
    cmd_prune "$2" "$3"
    ;;
  *)
    echo "usage: $0 {activate|prune} ..." >&2
    exit 2
    ;;
esac
