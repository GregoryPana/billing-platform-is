# Deployment Safety — Alembic Migration Cutover

**Status:** Established locally (2026-07-21) as part of Phase 1 / Task 1 of `docs/plans/2026-07-21-revenue-protection-issue-control.md`. No production database or deployment has been touched. This document exists specifically to prevent an unsafe first migration.

## What changed

- `backend/alembic/` was added: `alembic.ini`, `alembic/env.py` (wired to `app.config.settings.database_url` and `app.db.base.Base.metadata` — no connection string is duplicated in `alembic.ini`), and one migration: `alembic/versions/cd4f477b7e33_baseline_existing_schema.py`.
- The baseline migration was generated with `alembic revision --autogenerate` against a **completely empty** disposable local Postgres (via `docker-compose.yml`). It contains pure `CREATE TABLE` statements for all 10 current tables (`users`, `signup_requests`, `billing_cycles`, `approvals`, `approval_request_settings`, `audit_logs`, `generated_files`, `notifications`, `script_definitions`, `script_runs`) — i.e. it represents the schema exactly as `Base.metadata.create_all()` + the historical `_apply_schema_updates()` mutations in `backend/app/db/init_db.py` already produce today.
- Verified locally: `alembic heads` shows exactly one head; `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head` all succeed cleanly against the disposable database.
- `backend/app/db/init_db.py`'s `_apply_schema_updates()` is now frozen — it must not gain new `ALTER TABLE` statements for new functionality (e.g. the upcoming issue-control tables). It stays only as a safety net for any database that predates this baseline. All future schema changes ship as Alembic migrations.
- `.github/workflows/ci.yml`:
  - `test` job now asserts exactly one Alembic head (fails the build on branching/merge conflicts in migration history).
  - `deploy` job now runs `alembic upgrade head` before `sudo systemctl restart billing-api`, waits for the service to report active, and records `alembic current` plus real health status in the uploaded deploy metadata (replacing the previous hardcoded `health_status=unknown`).

## ⚠️ Mandatory one-time step before this ever reaches production

**The production database was built by `Base.metadata.create_all()` + `_apply_schema_updates()`, not by Alembic. It already has every table the baseline migration creates.**

If `alembic upgrade head` is run against production as a normal migration, it will attempt to `CREATE TABLE` on tables that already exist and **fail the deploy** (or worse, partially apply before failing, depending on transaction handling).

Before this branch is merged to `main` and deployed:

1. Connect to the production database out-of-band (not through this CI workflow).
2. Run **`alembic stamp head`** — NOT `alembic upgrade head` — against production. `stamp` records the revision as applied without running any DDL, which is correct here because the schema already matches.
3. Confirm with `alembic current` that production now reports `cd4f477b7e33 (head)`.
4. Only after that one-time stamp does the CI deploy job's `alembic upgrade head` step become a safe no-op for this revision, and a real migration runner for every future revision.

This step requires production database access and is explicitly **not** performed as part of this plan phase — it needs Gregory's direct action or explicit approval, per `AGENTS.md`'s rule against running destructive/production database commands without approval. Do not merge the CI workflow change to `main` until the stamp has happened, or schedule the stamp and the merge together in the same approved window.

## Required three-proof deploy evidence (going forward)

Every production deploy from this point forward should be verifiable with:

1. **Service uptime** — the CI `deploy` job's "Wait for service health" step now fails the workflow if `billing-api` isn't active within ~30s of restart.
2. **Migration revision** — `alembic current` is now captured in `deploy_metadata.txt` on every deploy.
3. **User-visible behaviour** — not automated yet; continues to require a manual authenticated check per role, per `docs/entra-id-integration-plan.md`'s rollout checklist.

## Local verification commands

```bash
cd backend
alembic heads
alembic current
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

Run against a disposable database only (e.g. `docker compose up -d postgres`, which maps to `localhost:5435`) — never against `backend/.env.local`'s configured dev database without knowing what's in it.
