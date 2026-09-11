#!/usr/bin/env bash
# Fail-closed host-identity and prerequisite validation. Performs no writes
# under the deploy target; a failure here must leave it completely
# untouched. Guards against this workflow accidentally running against the
# wrong self-hosted runner/host, or a host missing a tool a later mutation
# step silently assumes is present.
set -euo pipefail

marker_file="${HOST_MARKER_FILE:?HOST_MARKER_FILE is required}"
expected_marker="${EXPECTED_HOST_MARKER:?EXPECTED_HOST_MARKER is required}"
deploy_root="${DEPLOY_ROOT:?DEPLOY_ROOT is required}"
service_name="${SERVICE_NAME:?SERVICE_NAME is required}"
expected_service_user="${EXPECTED_SERVICE_USER:?EXPECTED_SERVICE_USER is required}"

fail=0
report() {
  echo "Host/prerequisite check failed: $1" >&2
  fail=1
}

if [[ ! -f "$marker_file" ]]; then
  report "expected host identity marker '${marker_file}' is absent - refusing to deploy to an unidentified host"
elif [[ "$(<"$marker_file")" != "$expected_marker" ]]; then
  report "host identity marker '${marker_file}' does not match the expected identity '${expected_marker}'"
fi

for bin in rsync python3 node npm pg_dump pg_restore systemctl stat; do
  command -v "$bin" >/dev/null 2>&1 || report "required binary '${bin}' is not on PATH"
done

if ! systemctl list-unit-files "${service_name}.service" --no-legend 2>/dev/null | grep -q "${service_name}.service"; then
  report "expected systemd unit '${service_name}.service' is not installed"
fi

service_user="$(systemctl show "${service_name}.service" --property=User --value 2>/dev/null || true)"
if [[ -z "$service_user" || "$service_user" == "root" ]]; then
  report "systemd unit '${service_name}.service' must not run as root"
elif [[ "$service_user" != "$expected_service_user" ]]; then
  report "systemd unit '${service_name}.service' runs as '${service_user}', expected '${expected_service_user}'"
fi

parent_dir="$(dirname "$deploy_root")"
if [[ ! -d "$parent_dir" || ! -w "$parent_dir" ]]; then
  report "deploy root parent '${parent_dir}' does not exist or is not writable"
fi

# The immutable layout preserves the externally visible backend/frontend
# paths using managed symlinks. An existing real directory requires a
# separately approved one-time migration; discovering it during activation
# (after backup/migration) would be too late.
for path in current backend frontend; do
  if [[ -e "${deploy_root}/${path}" && ! -L "${deploy_root}/${path}" ]]; then
    report "'${deploy_root}/${path}' exists but is not a managed symlink; complete the documented one-time layout migration first"
  fi
done

if [[ -L "$deploy_root" ]]; then
  report "deploy root '${deploy_root}' must not be a symlink"
fi
for path in releases backups shared; do
  if [[ -L "${deploy_root}/${path}" || ( -e "${deploy_root}/${path}" && ! -d "${deploy_root}/${path}" ) ]]; then
    report "'${deploy_root}/${path}' must be a real directory, not a file or symlink"
  fi
done

shared_config="${deploy_root}/shared/backend.env"
if [[ -e "$shared_config" || -L "$shared_config" ]]; then
  if [[ ! -f "$shared_config" || -L "$shared_config" ]]; then
    report "shared backend configuration must be a regular file"
  elif [[ "$(stat -c '%a' "$shared_config")" != "600" ]]; then
    report "shared backend configuration must have mode 0600"
  fi
fi

if [[ -L "${deploy_root}/current" ]]; then
  current_target="$(readlink "${deploy_root}/current")"
  if [[ ! "$current_target" =~ ^releases/[0-9a-f]{40}$ ]]; then
    report "'${deploy_root}/current' does not point to a managed full-SHA release"
  fi
fi
for path in backend frontend; do
  if [[ -L "${deploy_root}/${path}" && "$(readlink "${deploy_root}/${path}")" != "current/${path}" ]]; then
    report "'${deploy_root}/${path}' is not the expected managed compatibility symlink"
  fi
done

if (( fail != 0 )); then
  echo "One or more host/prerequisite checks failed; no deployment mutation has occurred." >&2
  exit 1
fi
echo "Host identity and prerequisites validated."
