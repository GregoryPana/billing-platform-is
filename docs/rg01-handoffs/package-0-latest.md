PACKAGE_ID: 0
PACKAGE_STATUS: completed

## Scope
Documentation-only rebaseline: `README.md`, `architecture/blueprint.md`, `project.md`, a superseded-header line on `ui-styling-guide.md`, and new `docs/DESIGN_SYSTEM_ADDENDUM.md`. No application code changed. Branch: `feature/cycle-usage-month-derivation` @ `8b9a5c2`, pre-existing dirty worktree preserved. This session's delta: the six files above plus `docs/RG01_ALIGNMENT_TRACKER.md` and `.opencode/hermes-pending-updates.md`.

## Rebaseline facts (verified against live code)
1. **Roles**: `auth_service.py:16-29,41-45` accepts only `system_admin`/`billing_user`/`finance_user` (stored `admin`/`billing`/`finance`); any other role, including `viewer`, is rejected by `normalize_role` with 403. `init_db.py:80` deactivates legacy `viewer` accounts on startup.
2. **Signup**: `backend/app/models/signup_request.py` does not exist (only stale `.pyc` files). `grep -rn signup backend/app frontend/src` hit only pycache binaries and one comment (`init_db.py:88`) confirming no signup path exists. `auth.py` exposes only `POST /login` and `GET /me`. Migration `f3a9c1d7e2b4_drop_signup_requests_table.py` confirms the table was intentionally dropped.
3. **App.jsx**: 154 lines — a routing shell (`HashRouter`/`Routes` + `RequireRole`) rendering pages from `frontend/src/features/*`, not a monolith, contrary to all three docs.
4. **Migrations**: `backend/alembic/versions/` has 4 files (`find`, correcting an earlier `ls *.py | wc -l` mis-report of 6). `alembic heads` returns exactly one head: `f3a9c1d7e2b4`.
5. **Tests**: 11 files under `backend/tests/`, 108 `def test_` functions.
6. **API URL**: `api.js:1,3` — `DEFAULT_API_URL = "http://localhost:8001/api"`, overridden by `VITE_API_URL`. README already stated this correctly; `project.md`'s own "mismatch" section (claiming README said `:8000`) was itself stale and is now corrected.

Bonus finding, load-bearing for the "auth model" correction: `init_db.py:84-109` seeds only **one** local account — break-glass admin (`admin`/`AdminChange2026!`) — not the four seed users all three docs described. `auth_service.py:113-129` shows Entra ID is now the primary auth path with local JWT as fallback. Fixed alongside the role correction since the two were inseparable in the docs' text.

## Files changed
- **README.md**: Roles, frontend/backend feature bullets, Architecture stack `auth:` line, implementation notes (App.jsx + migrations), API summary (removed signup endpoints), Default Seed Users (single break-glass admin), Known Gaps (test suite + migrations).
- **architecture/blueprint.md**: Implemented Scope, Roles, Main Backend Modules, Technical Constraints; replaced "Next Logical Evolution" (speculated future Entra migration) with "Entra ID Integration Status" (current state).
- **project.md**: Purpose line, Main User Roles (dropped Viewer, added role/stored-value map), Frontend Design + UX bullets (App.jsx), Backend Design `auth_service.py` bullet, Architectural Limitations, "Important Mismatches" section rewritten, closing debt-summary bullets.
- **ui-styling-guide.md**: one blockquote line noting supersession by `DESIGN_SYSTEM.md`; body untouched.
- **docs/DESIGN_SYSTEM_ADDENDUM.md** (new): classifies `recharts`/`framer-motion` absence as an inferred design-route decision (no chart/motion UI in `frontend/src`; neither is in the RG-01 Package 0–11 register) vs. `react-hook-form`+`zod` (Package 8) and `@tanstack/react-table` (Package 9), confirmed open backlog items. Includes a current-state dependency table from `frontend/package.json`.

## Contradictions with prompt assumptions
- Stale docs were worse than implied: they described a pre-Entra, local-JWT-only, four-seed-user, signup-era app. The auth-model fix was the largest single change, not a footnote.
- `docs/RG01_ALIGNMENT_TRACKER.md` is untracked (`??`) in git, not part of the pre-existing tracked dirty set; updated in place per RG-01 instructions.

## Checks run
No build/lint/test run — no code changed. Corrections are grounded in direct source reads plus one read-only `alembic heads` call.

## Next safe action
Package 1 (runtime origin/proxy verification), contingent on the provider usage gate.
