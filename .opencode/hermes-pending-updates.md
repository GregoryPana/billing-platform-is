# Hermes Pending Updates

## Flushed 2026-07-21

## 2026-07-21 05:15 — Finance cycle-review issue control planning package
- branch/commit: feature/entra-id-auth @ 3fa2156 (pushed to origin: no new commit)
- files: docs/FINANCE_ISSUE_CONTROL_DESIGN.md, docs/plans/2026-07-21-revenue-protection-issue-control.md, docs/wireframes/finance-test-review-approval.html
- verification: static wireframe served and browser-reviewed; git diff --check passed; independent Headroom/Claude review approved after two scope ambiguities were corrected
- flags: auth/security/data impact | deployment-needed | decision made | new risk

## 2026-07-21 05:20 — Implementation readiness and first-agent handoff pack
- branch/commit: feature/entra-id-auth @ 3fa2156 (pushed to origin: no new commit)
- files: docs/IMPLEMENTATION_READINESS_PACK.md, docs/FIRST_AGENT_PROMPT_REVENUE_PROTECTION.md
- verification: new-artifact whitespace checks passed after formatting correction; independent Headroom/Claude safety review approved
- flags: auth/security/data impact | deployment-needed | decision made | new risk

## 2026-07-21 06:05 — Pre-flight readiness assessment (Claude Code, read-only)
- branch/commit: feature/entra-id-auth @ 3fa2156 (pushed to origin: no)
- files: docs/IMPLEMENTATION_PRE_FLIGHT_REPORT.md (new, read-only report only)
- verification: CodeGraph unavailable (`codegraph: command not found`), fell back to direct git/grep/read inspection; no code run, no tests executed (none exist)
- flags: auth/security/data impact | decision made (Gate A/B/C all BLOCKED — NO-GO) | new risk (viewer role still authorized on nearly every GET endpoint and still seeded by default)

## 2026-07-21 09:58 — Phase 0 + Phase 1 of Revenue Protection Issue Control plan (Gates A and B closed locally)
- branch/commit: feature/entra-id-auth @ 29efa6f (pushed to origin: no)
- files: commit a823ad7 (bounded Entra integration slice, 74 files), commit 8f6d8db (viewer role retired: auth_service.py, init_db.py, all require_role() call sites, App.jsx, nav.js), commit 29efa6f (Alembic baseline: backend/alembic/, requirements.txt, ci.yml, docs/DEPLOYMENT_SAFETY.md, init_db.py comment)
- verification: backend py_compile clean; frontend npm run build + npm run lint clean; alembic heads/upgrade/downgrade/upgrade verified against disposable docker-compose Postgres (torn down after); alembic heads verified to work with no DATABASE_URL set (matches CI). Manual 3-role local-auth login smoke test NOT run (dev Postgres on :5432 unreachable this session) — open item for Gregory.
- flags: auth/security/data impact | deployment-needed (see below) | decision made (ENTRA_ENABLED stays false until Phase 9) | new risk: **production has NOT been `alembic stamp head`'d — merging this branch's CI change to main and deploying would run `alembic upgrade head` against a production DB that already has these tables via the old startup-mutation path, and CREATE TABLE would fail.** Documented prominently in docs/DEPLOYMENT_SAFETY.md; requires Gregory's direct production DB action before merge/deploy.

## 2026-07-21 10:04 — Phase 1a of Revenue Protection Issue Control plan (Gate C closed locally; all three gates now closed)
- branch/commit: feature/entra-id-auth @ 409951b (pushed to origin: no)
- files: backend/requirements-dev.txt (new), backend/tests/conftest.py (new), backend/tests/test_auth_roles.py (new, 6 tests), .github/workflows/ci.yml (postgres service + pytest step; fixed a deploy_metadata.txt path bug from the prior commit), .gitignore (recursive __pycache__/.pytest_cache ignore)
- verification: `pytest -q` run locally against disposable docker-compose Postgres — 6 passed, 0 failed (container torn down after). Includes a direct regression test proving a legacy role='viewer' row is now rejected at login (403 Unknown role).
- flags: auth/security/data impact | decision made (Gates A, B, C all closed locally — Phase 0/1/1a complete) | none new beyond the existing production-stamp risk logged above

Two items outstanding for Gregory (exact commands already given to him): (1) run `alembic stamp head` against production before this branch merges/deploys, (2) run the local 3-role login smoke test whenever his dev Postgres is reachable. Next: Phase 2 (issue persistence model + migration), which is the first task that touches actual business schema and should get its own review pass before proceeding.

## 2026-07-21 10:24 — Task 2 of Revenue Protection Issue Control plan (issue persistence model + migration)
- branch/commit: feature/entra-id-auth @ 9fec22f (pushed to origin: no)
- files: backend/app/models/billing_issue.py, billing_issue_activity.py (new), backend/app/models/__init__.py (modified), backend/alembic/versions/d6843df39f2f_add_billing_issue_controls.py (new), backend/app/schemas/issues.py (new), backend/tests/test_billing_issues_model.py (new, 8 tests), backend/tests/conftest.py (modified — new db_session fixture, client fixture now runs real Alembic migrations instead of create_all())
- verification: full backend suite 14/14 passed; alembic heads/upgrade/downgrade/upgrade verified against disposable docker-compose Postgres (torn down after); alembic heads verified without DATABASE_URL set
- flags: auth/security/data impact (none — no auth surface touched) | data/schema impact (three new tables + seed data, additive only, no production touched) | decision made (classifications shared via context="finance_review" for both finance_test_review and post_live_observation issues, per design doc section 4) | new risk: none beyond the existing pre-merge production-stamp requirement

Note: DB-level CHECK constraints now enforce completion-requires-outcome/actor/time and raised_in_error-requires-comment directly at the schema layer (belt-and-suspenders ahead of Task 3's API-layer enforcement). The "Other classification requires detail" rule needs a DB lookup of the classification name and is deferred to Task 3 (route/service layer), where classification_id can actually be resolved. Next: Task 3 (authorization + issue API lifecycle) — the first task exposing new endpoints.

Consolidated into a Hermes Update Pack on 2026-07-21 10:30 (7 entries above).

## 2026-07-21 11:19 — Task 3 of Revenue Protection Issue Control plan (authorization + issue API lifecycle)
- branch/commit: feature/entra-id-auth @ d9d8d90 (pushed to origin: no)
- files: backend/app/api/routes/issues.py (new), backend/app/api/router.py (modified — registered issues router), backend/app/schemas/issues.py (modified — added BillingIssueCommentCreate, BillingIssueEditRequest), backend/tests/test_billing_issue_routes.py (new, 15 tests), backend/tests/test_billing_issue_permissions.py (new, 14 tests)
- verification: 29 new tests + full suite 43/43 passed against disposable docker-compose Postgres (torn down after); alembic heads/current unchanged at d6843df39f2f (no new migration needed); backend py_compile clean
- flags: auth/security/data impact (new authorization surface: Billing-reads/Finance-writes permission matrix enforced per docs/plans/2026-07-21-revenue-protection-issue-control.md Task 3) | decision made (reopen gated on an existing approved stage="test" `approvals` row rather than a separate flag; post_live_observation never reopenable, matching design's MVP scope) | no new risk beyond the existing pre-merge production alembic-stamp requirement

Next: Task 4 (server-side Move-to-Live gate in approvals.py + issue_control_service.py) — awaiting Gregory's go-ahead before continuing past Task 3.
