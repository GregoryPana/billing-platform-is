# Controlled production deployment

Production changes are applied only by manually dispatching GitHub Actions. Pushes and pull requests run CI but never deploy.

## Trust and approval boundary

- Dispatch `.github/workflows/deploy-production.yml` from the repository's default `main` branch.
- Enter a branch, tag, or commit in `ref`, then type `DEPLOY-PRODUCTION` exactly.
- The workflow resolves the selector once to a full SHA. Before any selected-commit code can run, it fetches `main` and requires `git merge-base --is-ancestor "$RESOLVED_SHA" origin/main`. An unmerged branch, tag, or SHA is rejected.
- Tests and the production job check out that same full SHA. There is no fallback to the latest `main`.
- The production job uses `[self-hosted, billing]`, is bound to the `production` GitHub Environment, has read-only repository permission, and shares a non-cancelling concurrency group with rollback.

The manual confirmation is only the initial operator gate. Before the workflows are enabled, repository administrators must create the `production` Environment, limit deployments to protected `main`, configure required reviewers, prevent self-review, and move production secrets into that Environment. These live settings are part of the workflow trust boundary because a dispatch can otherwise select a modified workflow definition from another Git ref. Repository code cannot prove that the Environment settings are active, so they must be verified independently before any production run.

## One-time GitHub and host setup

1. Create the `production` Environment, restrict deployments to protected `main`, configure `GregoryPana` as the required reviewer, and prevent self-review. A different authorized operator must initiate a run that `GregoryPana` reviews; the initiator cannot approve the same run. Do not enable or dispatch the production workflows until these controls have been verified in GitHub.
2. Configure every secret named in the workflow. In particular, `BILLING_ENTRA_API_SCOPE` and `BILLING_ENTRA_REDIRECT_URI` are required. Do not use local-auth values in production.
3. Keep the runner labels `self-hosted`, `Linux`, `X64`, and `billing`.
4. Create `/etc/billing-deploy-target` containing exactly `billing-production`, owned so the runner cannot alter it.
5. Install the `billing-api` service to run as the non-root `billing` account using `ops/billing-api.service`. Confirm the service sandbox, the commands checked by `scripts/deployment/validate-host.sh`, and passwordless sudo only for the required `systemctl` operation. Host validation rejects a root-running service or a different service identity.
6. Before the first immutable-layout deployment, migrate the legacy `/opt/billing/backend` and `/opt/billing/frontend` directories out of those names during an approved maintenance window. The workflow fails closed if either path is an unmanaged directory. The release manager creates compatibility symlinks at those same paths, so systemd and Nginx paths do not change.
7. Complete the one-time Alembic baseline stamp described in `docs/DEPLOYMENT_SAFETY.md` before allowing migrations.

No setup action above is performed by this repository change.

## Deployment sequence

The workflow fails before touching `/opt/billing` if confirmation, ref resolution, trusted-main ancestry, CI, host identity, prerequisites, required configuration, or safe dotenv serialization fails. It then:

1. creates a new `/opt/billing/releases/<sha>` and refuses to reuse any existing path;
2. renders Entra-only configuration without interpolating secret values into shell source;
3. builds frontend and backend dependencies inside the release;
4. records the existing migration revision;
5. creates and verifies a timestamped PostgreSQL backup outside the release tree;
6. requires one Alembic head and runs `alembic upgrade head`;
7. writes non-secret release metadata and marks the release ready;
8. creates stable compatibility symlinks if absent, then atomically switches `/opt/billing/current`;
9. restarts `billing-api` and verifies restart, readiness, migration, and active revision;
10. marks the verified release complete, retains the active release plus five inactive releases, and uploads deployment evidence.

If restart or verification fails after activation, the workflow automatically restores the previously active release only when its recorded schema revision matches the database revision after migration. It never reverses a database migration. If no verified previous release exists, the revisions differ, or recovery verification fails, the run remains failed and records the active release and recovery outcome for operator intervention.

Backend runtime secrets are stored in `/opt/billing/shared/backend.env`, outside immutable release directories. Each release contains only a relative symlink to that shared file, so rollback does not revive stale credential copies. The workflow creates a mode-`0600` candidate, promotes it atomically at the release activation boundary, and restores the preceding configuration if activation or compatible automatic recovery fails. Secret values are never included in release metadata or uploaded evidence. Frontend `VITE_*` settings remain inside the release because they are browser-readable build inputs, not secrets.

A release path is write-once. If a run leaves an incomplete path, investigate it and remove it only through an approved host-maintenance action before retrying that SHA.

## Evidence

The `deploy_metadata-<sha>` artifact includes selected ref, resolved SHA, actor, run ID and URL, production target, migration before/after, health and runtime proofs, active and previous release, backup path, and rollback-attempt status. It contains no secrets.

## Rollback

Dispatch `.github/workflows/rollback-production.yml` from `main`, provide a retained full SHA, and type `ROLLBACK-PRODUCTION` exactly. Rollback tooling is checked out from trusted `main`; the target must also be reachable from `origin/main`, have immutable metadata, and have `.deploy-complete` from a previously verified deployment. Rollback does not rebuild or rewrite the release.

Rollback only atomically switches the release pointer and restarts/verifies the service. It never runs `alembic downgrade` and never reverses database changes. The current database revision must exactly match the release's recorded revision. A mismatch always fails closed; the workflow has no acknowledgement override and never treats operator confirmation as proof of schema compatibility.

The rollback artifact reports the target, actor/run details, recorded/current migration revisions, mismatch state, previous/active release, proofs, and success/failure.

## Local checks

```bash
for test in scripts/deployment/tests/test_*.sh; do bash "$test"; done
python3 -m unittest discover -s scripts/deployment/tests -p 'test_*.py'
python3 -c 'import yaml; [yaml.safe_load(open(p)) for p in [".github/workflows/ci.yml", ".github/workflows/deploy-production.yml", ".github/workflows/rollback-production.yml"]]'
```

These checks simulate controls locally; they do not validate a live runner, Environment configuration, production secrets, host permissions, database, systemd, Nginx, or a real deployment.
