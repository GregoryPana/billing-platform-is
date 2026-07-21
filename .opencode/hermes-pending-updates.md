# Hermes Pending Updates

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
