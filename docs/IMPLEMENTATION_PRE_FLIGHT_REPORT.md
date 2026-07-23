# Implementation Pre-Flight Report — Revenue Protection Issue Control

**Type:** Readiness / pre-flight assessment only. No feature code, schema, or business logic was changed to produce this report.

## 1. Timestamp, branch, HEAD, repo state

- Timestamp: 2026-07-21
- Branch: `feature/entra-id-auth`
- HEAD SHA: `3fa21560c5359db06b81e7305ea6f5873d4fb451` ("docs: add cross-agent harness")
- Upstream: none configured (`git rev-parse @{u}` fails — branch has never been pushed/tracked)
- Working tree: dirty, pre-existing (all listed below predate this session; nothing was modified during this assessment)

**Pre-existing modified (tracked) files:**
`.env.example`, `.github/workflows/ci.yml`, `.gitignore`, `backend/.env.local.example`, `backend/.env.production.example`, `backend/app/api/routes/{approvals,audit,auth,cycles,notifications,runs,scripts,users}.py`, `backend/app/config.py`, `backend/app/db/init_db.py`, `backend/app/models/user.py`, `backend/app/schemas/auth.py`, `backend/app/services/auth_service.py`, `docs/entra-id-integration-plan.md`, `frontend/.env.local.example`, `frontend/.env.production.example`, `frontend/index.html`, `frontend/package-lock.json`, `frontend/package.json`, `frontend/src/App.css`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/tailwind.config.js` (and `frontend/src/index.css` deleted)

**Pre-existing untracked files:** `.claude/settings.json`, `.mcp.json`, `.opencode/hermes-pending-updates.md`, `.serena/`, `06_ENTRA_ID_INTEGRATION_GUIDE.md`, `DESIGN_SYSTEM.md`, `backend/app/services/entra_auth_service.py`, `docs/AGENT_DESIGN_SKILLS.md`, `docs/FINANCE_ISSUE_CONTROL_DESIGN.md`, `docs/FIRST_AGENT_PROMPT_REVENUE_PROTECTION.md`, `docs/IMPLEMENTATION_READINESS_PACK.md`, `docs/plans/`, `docs/ux-flow-and-ia-notes.md`, `docs/wireframes/`, `frontend/src/components/`, `frontend/src/context/`, `frontend/src/entra.js`, `frontend/src/features/`, `frontend/src/lib/format.js`, `skills/`

None of this was touched, staged, or reverted during this assessment (per instruction and repo safety rules).

## 2. Files/symbols inspected

CodeGraph was attempted first (`codegraph status`) and is **unavailable** in this environment (`command not found`). All discovery below used direct reads/`git`/`grep` instead, as instructed when CodeGraph is unavailable.

Inspected directly:
- `backend/app/services/auth_service.py` — `CurrentActor`, `get_current_actor`, `require_role`, `normalize_role`, `LEGACY_TO_EFFECTIVE_ROLE`, `EFFECTIVE_TO_STORED_ROLE`
- `backend/app/services/entra_auth_service.py` — `validate_entra_token`, `_claims_to_role`, `_groups_to_role`, `upsert_entra_user`, `ROLE_PRECEDENCE`
- `backend/app/models/user.py` — `User` model/columns
- `backend/app/db/init_db.py` — `init_db`, `_apply_schema_updates`, `_seed_default_users`
- `backend/app/config.py` — `Settings` (Entra config fields; no secret values read)
- `backend/app/api/routes/{approvals,audit,auth,cycles,notifications,runs,scripts,users}.py` — role-gated endpoints, `require_role(...)` call sites
- `backend/app/services/workflow_service.py` — `ensure_stage_runs_executed` (run-readiness/approval precondition)
- `.github/workflows/ci.yml` — CI test/build/deploy pipeline
- `frontend/src/App.jsx`, `frontend/src/components/layout/nav.js` — frontend role gating (`RequireRole`, `viewer` references)
- `backend/requirements.txt` — dependency list (no `alembic`, no `pytest`)
- `git log` on auth-related files for change history

Not found (confirms Gate B/C blockers): `backend/alembic/`, `backend/tests/` — both glob searches returned no matches.

## 3. Gate A — Entra/base-worktree readiness: **BLOCKED**

Evidence:
- The `feature/entra-id-auth` branch has **never been pushed** (no upstream) and contains a large, unreviewed, uncommitted diff spanning auth, CI, frontend shell, and docs (list above). There is no clean commit boundary to diff a new feature against, and no PR/review has happened on this Entra work.
- **`viewer` is not retired.** It is still:
  - a locally seeded default user in `_seed_default_users()` (`backend/app/db/init_db.py:121-131`, role `"viewer"`);
  - a valid mapped role in `LEGACY_TO_EFFECTIVE_ROLE`/`EFFECTIVE_TO_STORED_ROLE` (`auth_service.py:16-30`);
  - explicitly authorized on nearly every read (`GET`) endpoint via `require_role(role_set(..., "viewer"))` in `auth.py:79`, `approvals.py:60`, `audit.py:17`, `cycles.py:19`, `notifications.py:21`, `runs.py:19`, `scripts.py:29,194`;
  - referenced in the frontend (`frontend/src/App.jsx:88,99,107` — `RequireRole role={role} allowed={[..., "viewer"]}`, and `frontend/src/components/layout/nav.js`).
  - Business contract requires exactly `billing_user`, `finance_user`, `system_admin` with viewer retired, not retained — current code contradicts this.
- Entra role resolution (`entra_auth_service.py`) does correctly target only `system_admin`/`billing_user`/`finance_user` (`ROLE_PRECEDENCE`), so the **Entra-side** claim mapping is consistent with the target model — the mismatch is entirely in the **local/legacy** path that Entra falls back to (`get_current_actor` tries local JWT first, then Entra only if `entra_enabled`).
- `Settings.entra_enabled` defaults to `False`; the repo's own `.env.production.example` was modified in this dirty tree but its contents were not read (would require inspecting env file contents, out of scope/disallowed without approval) — actual production `ENTRA_ENABLED` value is unknown and was not inspected.
- No automated test exists to confirm role-authorization behavior for any of the three target roles (see Gate C).

**Conclusion:** Existing Entra/auth work is present but not reviewed, not committed as a bounded change, not test-covered, and still retains the legacy `viewer` role as an authorized principal across most read endpoints. This exactly matches Gate A's precondition list in `docs/IMPLEMENTATION_READINESS_PACK.md` and is **not satisfied**.

## 4. Gate B — migration/deployment readiness: **BLOCKED**

Evidence:
- No `backend/alembic/` directory exists (`Glob backend/alembic/**` → no files found). No `backend/alembic.ini`.
- `alembic` is **not** in `backend/requirements.txt` (grep for `alembic` returned nothing).
- Schema changes are currently performed via imperative, startup-time raw SQL in `_apply_schema_updates()` (`backend/app/db/init_db.py:18-76`) — additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements run on every app boot, with no revision history, no downgrade path, and no way to verify "current" schema state distinct from "whatever code happens to run next."
- `.github/workflows/ci.yml` deploy job (lines 49-146) restarts `billing-api` directly after building — there is no migration step before or after restart, and no post-deploy health/revision proof (the `deploy_metadata.txt` step hardcodes `health_status=unknown` and never checks it).
- CI `test` job only runs `python -m py_compile app/main.py` as a "smoke check" (line 27-30) — not a real schema or migration verification.

**Conclusion:** Exactly matches the plan's stated precondition ("no Alembic migration framework and startup schema mutation exists"). Gate B is **not satisfied**; Task 1 of the plan (establish Alembic baseline) is the correct next bounded task once Gate A is resolved.

## 5. Gate C — test harness readiness: **BLOCKED**

Evidence:
- No `backend/tests/` directory exists (`Glob backend/tests/**` → no files found).
- `pytest` is **not** in `backend/requirements.txt`.
- No frontend test tooling was found referenced in `frontend/package.json` beyond build/lint scripts (not independently re-verified beyond requirements/CI inspection above, since CI confirms only `npm run build`/`npm ci` are run — no `npm test`/`vitest`/`jest` step in `ci.yml`).
- CI has no test-execution step for backend behavior at all — only a compile check and a frontend build.

**Conclusion:** No tracked automated test harness exists on either side. A failing regression test cannot currently be written and run against tracked infrastructure. Gate C is **not satisfied**.

## 6. Exact smallest next safe task

Per `docs/plans/2026-07-21-revenue-protection-issue-control.md`, the correct next bounded task is **not** Task 1 yet — it is the plan's own **"Prerequisite release boundary"** section, because Gate A must close before Task 1 (which is itself Gate B) can be trusted as an isolated diff:

1. Independently review the current `feature/entra-id-auth` diff (list in §1) with Gregory; decide whether to commit it as-is, split it, or reset to a clean base commit.
2. Resolve the `viewer` role: decide and implement its removal/retirement path (stop seeding it, remove it from every `require_role(...)` call site listed in §3, remove `RequireRole` allowances in `frontend/src/App.jsx`/`nav.js`) — this is a scoped, reviewable change, not the issue-control feature itself.
3. Confirm intended `ENTRA_ENABLED` rollout state for production without reading the actual `.env` value (ask Gregory directly, per the plan's "do not inspect secret values" rule).
4. Only after that boundary is committed: start Task 1 (`backend/alembic/`, `alembic.ini`, `backend/app/db/init_db.py` migration cutover, `docs/DEPLOYMENT_SAFETY.md`) exactly as scoped in the plan, with verification commands:
   ```bash
   cd backend
   alembic heads
   alembic current
   alembic upgrade head
   alembic downgrade -1
   alembic upgrade head
   ```
5. In parallel or immediately after, establish the Gate C pytest harness (`backend/tests/`, add `pytest` to `requirements.txt`) so Task 1's migration work and all subsequent tasks are test-verifiable from the start.

## 7. GO / NO-GO decision

**NO-GO.** All three readiness gates (A, B, C) are BLOCKED. Do not begin schema work, issue-control models, or business logic. Do not start Phase 1 of the plan until the "Prerequisite release boundary" step above is completed and reviewed with Gregory.

## 8. Notes

- No secrets were read or printed. `.env*` file contents were not opened; only filenames/diff status were observed via `git status`.
- No production state was guessed; all statements above are drawn from the current worktree, CI YAML, and code inspected directly.
- No implementation code was written for the issue-control feature.
