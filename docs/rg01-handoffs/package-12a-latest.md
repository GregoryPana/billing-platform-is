PACKAGE_ID: 12A
PACKAGE_STATUS: completed

## Scope

Production Entra-only authentication cutover and fail-closed deployment
configuration, per RG-01 Package 12A instructions. Worktree:
`feature/rg01-package-12-entra-only`, starting HEAD `291521c` (verified —
`git log -1` still shows `291521c8bc343e1e8c9483f08a7b1e7ca8ef5ce3 feat:
align RG-01 billing platform for pilot readiness` as the parent of this
session's changes). No commit, push, deploy, migration, or auth rollout was
performed.

## Exact files changed

- `backend/app/config.py` — added `Settings.auth_mode` (`"local"` default) +
  `is_entra_auth_mode` property; removed `entra_enabled` field.
- `backend/app/services/auth_service.py` — `get_current_actor()` now
  branches once on `settings.is_entra_auth_mode` (Entra-only vs local-only),
  replacing the old try-local-then-fall-back-to-Entra chain.
- `backend/app/api/routes/auth.py` — `POST /auth/login` returns `404` in
  Entra mode before touching any credential/DB logic.
- `backend/tests/test_entra_dual_auth.py` — rewritten for the either/or
  contract (see Tests below).
- `backend/.env.local.example`, `backend/.env.production.example`,
  `.env.example` — `ENTRA_ENABLED=false` replaced with `AUTH_MODE=local` /
  `AUTH_MODE=entra` (variable names/example values only, consistent with
  the pre-existing example-file convention; no real secret values).
- `frontend/src/entra.js` — `VITE_AUTH_MODE` → `auth_mode` /
  `is_entra_auth_mode`; `entra_enabled` is now `is_entra_auth_mode &&
  entra_configured`; added `entra_config_error`; split the old
  `bootstrap_entra_token()` into `complete_entra_redirect()` (redirect-promise
  handling + active-account lookup only) and `acquire_entra_token()` (silent
  token acquisition), so App.jsx can decide "redirect now" vs "use existing
  session" without an implicit combined side effect.
- `frontend/src/App.jsx` — Entra-mode bootstrap now calls
  `complete_entra_redirect()` then, if no usable session, calls
  `sign_in_with_entra()` immediately (before ever rendering `LoginPage`); a
  `sessionStorage` guard (`billing_entra_redirect_guard`) prevents an
  infinite redirect loop and surfaces a fail-closed `EntraSignInError` retry
  screen if a redirect round-trip doesn't produce a session; the same error
  surface (no retry) is shown when `entra_config_error` is set; `handle_sign_out`
  now checks `is_entra_auth_mode` instead of the previous session's
  `auth_source`.
- `frontend/src/features/auth/LoginPage.jsx` — removed the conditional "Sign
  In With Microsoft" button; this page now only renders in explicit local
  mode, where Entra is never involved.
- `frontend/.env.local.example`, `frontend/.env.production.example` —
  `VITE_ENTRA_ENABLED=false` replaced with `VITE_AUTH_MODE=local` /
  `VITE_AUTH_MODE=entra`.
- `.github/workflows/ci.yml` — deploy job now writes `AUTH_MODE=entra` /
  `VITE_AUTH_MODE=entra` unconditionally (removed the
  `${{ secrets.BILLING_ENTRA_ENABLED || false }}` fallback in both the
  backend and frontend env-write steps); added a "Validate required Entra
  settings are present" step (presence-only check of
  `BILLING_ENTRA_TENANT_ID`/`BILLING_ENTRA_CLIENT_ID`/
  `BILLING_ENTRA_API_SCOPE`/`BILLING_ENTRA_REDIRECT_URI`, never prints
  values, fails the job before frontend build / Alembic upgrade / service
  restart) run right after the env files are written; test job's backend
  tests step now sets `AUTH_MODE: local` explicitly. No change to
  `stamp-production-db.yml`, runner labels (`[self-hosted, billing]`),
  `/opt/billing`, `billing-api`, rsync excludes, or the migrate/restart/
  health-check/metadata steps.
- `docs/entra-id-integration-plan.md` — added a dated
  "Implementation status (2026-09-02, RG-01 Package 12A)" section recording
  the cutover; updated the live "Rollback strategy" section to the new
  `AUTH_MODE`/`VITE_AUTH_MODE` contract; annotated the `ENTRA_ENABLED`
  settings-list line as superseded. The original Phase A–D narrative and the
  2026-07-22/24 "Implementation status" sections were left untouched as
  historical record of the design that preceded this cutover.

Pre-existing dirty file **not** touched by this session: `.serena/project.yml`
(already modified before this package started; left exactly as found).

## Backend contract

- `AUTH_MODE` env var (pydantic `Settings.auth_mode`), default `"local"`.
- `local` (default): only local JWT auth is accepted. `/api/auth/login`
  checks username/password and issues a local JWT as before.
  `get_current_actor()` only attempts local JWT decoding; Entra validation
  is never invoked.
- `entra` (explicit): only Entra bearer tokens are accepted.
  `/api/auth/login` returns `404` without checking any credential or issuing
  any token. `get_current_actor()` only attempts Entra token validation via
  the pre-existing `entra_auth_service.validate_entra_token()` /
  `upsert_entra_user()` — local JWT decoding is never attempted, so a
  stale/forged local JWT cannot grant access once `AUTH_MODE=entra`.
  Incomplete Entra config (missing tenant/client ID) surfaces the existing
  `entra_auth_service.py` `500` "not configured" errors — reached directly
  now, not through a fallback path — rather than silently falling back to
  local auth (there is no local path to fall back to in this mode).
- Role/group mapping (`_claims_to_role`, `ROLE_PRECEDENCE`,
  `ENTRA_*_GROUP_ID` fallback) and `require_role()` authorization guards are
  unchanged.

## Frontend contract

- `VITE_AUTH_MODE` env var, default `"local"`.
- `local` (default): `LoginPage` renders directly on no-session, exactly as
  before minus the now-removed conditional Microsoft button. No MSAL client
  is constructed at all.
- `entra` (explicit): after `complete_entra_redirect()` (wraps
  `handleRedirectPromise` + active-account lookup), if there is no usable
  account/token, `sign_in_with_entra()` (MSAL `loginRedirect`) is called
  immediately — `LoginPage` is never rendered in this mode. A
  `sessionStorage` guard prevents redirecting more than once per
  unsuccessful round-trip; a failed round-trip, a thrown redirect/token
  error, or missing public Entra config (`VITE_ENTRA_TENANT_ID`/
  `VITE_ENTRA_CLIENT_ID`/`VITE_ENTRA_AUTHORITY`/`VITE_ENTRA_API_SCOPE`) all
  render the same fail-closed `EntraSignInError` surface with no local
  fields; the config-error case omits the retry button since retrying
  cannot fix missing configuration. Logout always calls Entra
  `logoutRedirect` in this mode.

## Deployment contract

- Production backend `.env`: `AUTH_MODE=entra` (was
  `ENTRA_ENABLED=${{ secrets.BILLING_ENTRA_ENABLED || false }}`).
- Production frontend `.env.production`: `VITE_AUTH_MODE=entra` (same fix).
- Neither value depends on a GitHub secret anymore, so a missing/unset
  `BILLING_ENTRA_ENABLED` secret can no longer silently produce a
  local-login production deployment.
- New pre-build/pre-restart step fails the deploy if
  `BILLING_ENTRA_TENANT_ID`, `BILLING_ENTRA_CLIENT_ID`,
  `BILLING_ENTRA_API_SCOPE`, or `BILLING_ENTRA_REDIRECT_URI` secrets are
  unset — checked for presence only, values are never echoed.
- Existing Entra secret names, `/opt/billing`, `billing-api`,
  `[self-hosted, billing]` runner label, rsync excludes, migration
  (`alembic upgrade head`), restart, health-check, and deploy-metadata steps
  are all byte-identical apart from the two lines above and the new
  validation step.

## Tests / checks run and real results

- **Focused backend auth tests** —
  `pytest -q tests/test_entra_dual_auth.py tests/test_entra_auth_service.py tests/test_auth_roles.py`
  against a disposable `postgres:16-alpine` container (`rg01pkg12a_pg`, port
  `55912`, `--rm`, not the persistent `billing_postgres:5435`): **34 passed**,
  3 pre-existing deprecation warnings (passlib `crypt`, FastAPI `on_event`),
  0 failed.
- **Full backend suite** — `pytest -q` against the same disposable DB, real
  Alembic migration path (conftest drops/recreates schema and runs
  `alembic upgrade head`, not `Base.metadata.create_all()`): **110 passed**,
  same 3 warnings, 0 failed.
- **Alembic checks** — `alembic heads --resolve-dependencies` → single head
  `f3a9c1d7e2b4`; `alembic current` → `f3a9c1d7e2b4 (head)`, matches.
- **Frontend lint** — `npm run lint`: 0 errors, 1 pre-existing React
  Compiler warning on `sortable-table.jsx`'s `useReactTable()` (unrelated to
  this change, present before this package).
- **Frontend build** — `npm run build`: passed, `dist/` produced; pre-existing
  large main-chunk warning only (unrelated).
- **Workflow YAML/shell syntax** — `python3 -c "yaml.safe_load(...)"` on both
  `.github/workflows/ci.yml` and `stamp-production-db.yml`: valid YAML. Every
  `run:` block in `ci.yml` (extracted via PyYAML, one per step) passed
  `bash -n`: no syntax errors, including the new "Validate required Entra
  settings are present" step.
- **Source-level assertion** — confirmed no remaining `ENTRA_ENABLED`
  reference anywhere under `.github/`, `backend/.env*`, `frontend/.env*`, or
  `.env.example`; confirmed `.github/workflows/ci.yml` contains
  unconditional `AUTH_MODE=entra` (backend) and `VITE_AUTH_MODE=entra`
  (frontend) with no `${{ secrets.BILLING_ENTRA_ENABLED || false }}` fallback
  anywhere in the file.
- **Mocked/deterministic browser verification** — Playwright (Chromium,
  headless) against three disposable Vite dev servers, each built from a
  throwaway `vite.pkg12a.config.js` that aliased `@azure/msal-browser` to a
  disposable fake module (`pkg12a_fake_msal.js`, deleted after) implementing
  the same call surface used by `entra.js` (`handleRedirectPromise`,
  `getActiveAccount`/`getAllAccounts`, `acquireTokenSilent`, `loginRedirect`,
  `logoutRedirect`) with a `window.__pkg12a_scenario` switch — no real Entra
  network call was made. Four scenarios, all **PASS**:
  1. Entra mode, no session (`VITE_AUTH_MODE=entra`, valid config,
     `no_session` scenario): `handleRedirectPromise` called before
     `loginRedirect`; `loginRedirect` fires; zero password/username input
     fields ever appear in the DOM; zero console errors.
  2. Entra mode, existing session (`existing_session` scenario, `/auth/me`
     network call mocked via Playwright route interception):
     `loginRedirect` is never called; `acquireTokenSilent` succeeds; the
     app reaches the authenticated shell (`Overview` visible in the DOM).
  3. Entra mode, missing public config (`VITE_AUTH_MODE=entra`, no
     `VITE_ENTRA_*` values set): fail-closed configuration-error screen
     shown, zero password fields, no "Try Microsoft Sign-In Again" button
     (retry is intentionally withheld for a static config problem).
  4. Explicit local mode (`VITE_AUTH_MODE=local`): `LoginPage` renders
     directly with exactly one password field and a "Sign In" button, zero
     MSAL calls, zero console errors.

## What was mocked vs. live

- **Live**: disposable PostgreSQL 16 (real Alembic migration path, real
  SQLAlchemy models, real password hashing/JWT signing/verification), real
  FastAPI app via `TestClient`, real Vite build/lint/dev-server toolchain,
  real Playwright/Chromium browser.
- **Mocked**: `@azure/msal-browser` (aliased to a disposable fake module for
  the four browser scenarios only — not used by the backend test suite,
  which uses real local JWTs and `monkeypatch`es
  `entra_auth_service.validate_entra_token` at the Python function level,
  the same pattern already used by the pre-existing Entra test suite); the
  `/api/auth/me` HTTP response in browser scenario 2 (Playwright route
  interception, since no backend was running for the browser checks). No
  real Entra tenant, app registration, credentials, or network call was
  used anywhere in this package.

## Host / routes / services / deployment footprint

Confirmed unchanged: `/opt/billing`, `billing-api` systemd unit,
`[self-hosted, billing]` runner label, `/billing/` and `/billing-api/`
Nginx paths (untouched, not referenced by this diff), rsync excludes, the
Alembic migrate → restart → health-check → metadata sequence, and all
existing `BILLING_ENTRA_*`/`BILLING_*` GitHub secret **names** (no secret
was read, set, or renamed — `git diff .github/workflows/ci.yml` shows only
the `AUTH_MODE`/`VITE_AUTH_MODE` value lines and the new validation step).

## Remaining Package 12B work

1. The actual production cutover: confirming the real `BILLING_ENTRA_*`
   GitHub secrets are set (per `docs/entra-id-integration-plan.md`'s
   "New/still open" item 4 from the prior Entra work), then a
   Gregory-approved deploy of this branch to `main`.
2. Running the plan's Phase B/C live verification checklist against the
   real production Entra app registration (sign-in succeeds, `/auth/me`
   succeeds with a real Entra token, role derivation, `403` for
   unauthorized users) — none of this can be done from an isolated worktree
   without real credentials.
3. Deciding and scheduling the moment local sign-in becomes fully
   unreachable for real users (this package makes `AUTH_MODE=entra` the
   production default in the CI workflow, but the actual deploy/cutover
   timing is a separate approval).
4. Package 4 (real Finance/Billing pilot) and the other RG-01 external gates
   recorded in `docs/RG01_ALIGNMENT_TRACKER.md` remain outstanding and are
   unrelated to this package's scope.

## Commit / push / deploy / migration / auth rollout

None performed. No `.env*` file was read, printed, or created with real
values (only the tracked `.env*.example` files were edited — variable names
only). All disposable resources (Postgres container, Python venv, npm
`node_modules` install used only for lint/build, three Vite dev servers,
the fake-MSAL vite config/module, temporary `.env.pkg12a-*.local` files,
Playwright scripts) were removed/stopped after verification; `git status`
confirms only the fifteen files listed above are modified, matching exactly
this session's intended changes plus the pre-existing `.serena/project.yml`
this session did not touch.
