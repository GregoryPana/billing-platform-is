# Entra ID Integration Plan

## Goal

Replace the current local username/password and signup-approval model with Microsoft Entra ID authentication, while preserving the billing workflow, approvals, and deployment paths.

This should eventually remove or greatly reduce the need for:

- local signup requests
- admin approval of new user access
- local password storage
- manual user creation for normal access onboarding

The target access model for this application is exactly three roles:

- `finance_user`
- `billing_user`
- `system_admin`

## Current Auth Model

The current implementation uses:

- local users stored in Postgres
- password hashes stored in `users.password_hash`
- JWTs issued by the FastAPI backend
- signup requests stored in `signup_requests`
- admin-managed account approval and user CRUD

Relevant code areas:

- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/users.py`
- `backend/app/services/auth_service.py`
- `backend/app/models/user.py`
- `backend/app/models/signup_request.py`
- `frontend/src/App.jsx`
- `frontend/src/api.js`

## Target Auth Model

### Recommended direction

Use Entra ID for user authentication in the frontend and have the backend validate Entra-issued bearer tokens.

Recommended high-level shape:

1. Frontend signs users in with Entra ID.
2. Frontend sends Entra access token to the backend.
3. Backend validates token issuer, audience, expiry, and signature.
4. Backend resolves the user identity from claims.
5. Backend maps the identity to an application role.

## Role Strategy

Use Entra group or app-role claims as the source of authorization.

Target application roles:

- Entra finance group/app role -> `finance_user`
- Entra billing group/app role -> `billing_user`
- Entra admin group/app role -> `system_admin`

Expected access model:

- `finance_user`: finance-only functionality
- `billing_user`: billing functionality only
- `system_admin`: both finance and billing functionality, plus logs and audit visibility

This is preferable to email-based mapping because it is centrally manageable and easier to audit.

## User And Group Visibility From Entra

### What the app can reliably see on login

When a user authenticates with Entra ID, the app can capture claims for that signed-in user, such as:

- unique user identifier
- display name
- email or preferred username
- app role claims or group IDs

### What the app does not automatically get

The app does not automatically receive a full list of all users, all groups, or all group memberships for the Entra app registration.

To enumerate that centrally, the application would need Microsoft Graph access with additional consented permissions.

### Recommended design for this system

Do not depend on full directory enumeration for normal runtime access control.

Instead:

1. treat Entra token claims as the source of truth for the current session
2. capture signed-in user details locally for audit and support visibility
3. update the local user record whenever the user logs in and current claims differ

## Local User Record Strategy

Keep a local `users` table, but repurpose it.

Recommended purpose:

- audit readability
- support visibility
- local history of who accessed the platform
- tracking latest observed role and group/app-role assignment

Recommended fields to retain or add:

- stable Entra subject or object ID
- provider name, for example `entra_id`
- display name
- email
- current effective app role
- latest group IDs or role claims snapshot
- first seen timestamp
- last seen timestamp
- active flag if needed for local reporting

Important rule:

- authorization should come from the current Entra token claims, not from the cached local row

That ensures that if a user's Entra groups or roles change, their next authenticated session reflects the new access immediately.

## Recommended Implementation Phases

## Phase 1: Introduce Entra ID Without Removing Local Auth

Goal: make Entra login work while keeping the current local auth path available as a fallback during rollout.

Backend changes:

- add Entra configuration settings:
  - tenant ID
  - client ID / API audience
  - allowed issuers
  - claim mapping config
- add token validation against Microsoft identity metadata and JWKS
- extend `get_current_actor()` so it can validate Entra bearer tokens
- add a normalized identity model containing:
  - Entra subject or object ID
  - display name
  - email or preferred username
  - mapped app role
  - latest group or app-role claims
- upsert a local `users` row for audit readability and continuity
- record user access events in audit logs on successful authenticated access

Frontend changes:

- add Microsoft sign-in flow
- store and send Entra access token instead of local JWT when using Entra login
- keep the current login path available behind a temporary toggle until rollout is complete

Operational outcome:

- existing users can continue working
- selected users can start using Entra ID

## Phase 2: Move Authorization Ownership To Entra ID

Goal: stop using local admin onboarding for normal access.

Backend changes:

- make role resolution come from Entra claims or a controlled mapping table
- stop relying on local signup requests for new users
- mark local password and signup flows as deprecated

Frontend changes:

- remove signup request UI
- remove local login form for standard users
- replace login screen with Microsoft sign-in

Operational outcome:

- access is controlled through Entra group membership or app roles
- onboarding is handled outside the app

## Phase 3: Remove Obsolete Local Admin/Auth Features

Goal: simplify the product after Entra rollout is complete.

Likely removals or reductions:

- `POST /auth/signup`
- signup request approval/rejection endpoints
- signup request screens in admin
- local password reset/update paths
- most direct user creation flows

The `system_admin` role still remains as an application role, but its assignment should come from Entra rather than local onboarding.

## Backend Work Plan

### 1. Add configuration

Add settings such as:

- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_API_AUDIENCE`
- `ENTRA_AUTHORITY`
- `AUTH_MODE` (superseded `ENTRA_ENABLED` in Package 12A — see the
  "Implementation status (2026-09-02, Package 12A)" section below)
- `ENTRA_FINANCE_GROUP_ID`
- `ENTRA_BILLING_GROUP_ID`
- `ENTRA_SYSTEM_ADMIN_GROUP_ID`

### 2. Add token validation service

Add a new backend service, for example:

- `backend/app/services/entra_auth_service.py`

Responsibilities:

- fetch OpenID configuration
- fetch JWKS signing keys
- validate JWT signature and claims
- normalize user claims
- extract roles or groups
- map claims to exactly one effective application role

### 3. Update auth dependency

Refactor `auth_service.py` so authorization can support:

- local JWTs during migration
- Entra tokens during and after migration

Prefer a small abstraction like:

- `resolve_current_identity()`
- `map_identity_to_actor()`

### 4. Repurpose `users` as an audit-oriented identity cache

Recommended retention:

- keep `users` for audit display and local support metadata
- stop using it as the primary credential store
- treat `password_hash` as legacy once local auth is removed

Potential schema additions or adjustments:

- `external_provider`
- `external_subject`
- `display_name`
- `last_login_at`
- `last_seen_role`
- `last_seen_groups`

### 5. Update audit behavior

Audit records should continue to show meaningful actors after Entra migration.

Recommended:

- store actor email/display name where helpful in metadata
- preserve stable actor identifiers from Entra `sub` or object ID claims
- add explicit user-access audit events for login/session establishment

## Frontend Work Plan

### 1. Add Microsoft login support

Recommended library:

- `@azure/msal-browser`
- `@azure/msal-react`

Frontend tasks:

- initialize MSAL in app bootstrap
- add login redirect or popup flow
- acquire token for the backend API audience
- send that token through `api.js`
- update logout to clear MSAL session state

### 2. Replace the current login/signup screen

Current auth screen in `frontend/src/App.jsx` should evolve to:

- Sign in with Microsoft
- optional temporary fallback login during transition only

### 3. Remove obsolete admin UX later

When rollout is complete, remove:

- signup request form
- signup request approval table
- direct user provisioning workflows that are replaced by Entra

## Data And Migration Considerations

### Users table

Existing users can be preserved during migration.

Recommended approach:

- match users by email during transition where possible
- backfill external identity fields on first successful Entra login
- convert the table into a local identity cache and audit support table
- do not use the row itself as the authority for current access
- do not delete existing users immediately

### Signup requests

Local self-service signup and admin-created local accounts were retired in `feature/entra-only-auth` (PR #13). The `signup_requests` table and its model/schemas/routes/UI are fully removed; the table itself is dropped by `backend/alembic/versions/f3a9c1d7e2b4_drop_signup_requests_table.py`.

## Deployment And Environment Impact

## Current automatic deployment behavior

The current GitHub Actions workflow automatically deploys on push to `main`.

It does:

- repo sync to `/opt/billing`
- backend env rewrite
- frontend env rewrite
- frontend build
- backend virtualenv dependency install
- `sudo systemctl restart billing-api`

It does not:

- edit Nginx config
- reload Nginx
- create or modify location blocks

## Nginx impact for Entra ID

Based on the provided VM config, existing application paths can be preserved.

Current billing paths already exist:

- `/billing/`
- `/billing-api/`

If the frontend remains under `/billing/` and uses SPA routing for any auth callback path under that prefix, no Nginx change is inherently required.

Examples that should fit the current setup:

- `/billing/`
- `/billing/auth/callback`

The existing location block:

```nginx
location /billing/ {
    alias /opt/billing/frontend/dist/;
    try_files $uri $uri/ /billing/index.html;
}
```

already supports frontend-side deep links under `/billing/`.

Potential reasons you might still need Nginx changes later:

- if you choose a callback path outside `/billing/`
- if you add a backend-only auth callback endpoint that should be externally exposed on a new path
- if stricter CSP or auth-related headers are required for Microsoft sign-in flows

But none of that is part of the current deploy workflow, and nothing in the current CI/CD would overwrite the existing `hr-system` site file.

## Risks

- group/role claims may not be present by default unless Entra app registration is configured correctly
- audience mismatch between frontend-acquired token and backend validation is a common failure mode
- full group membership enumeration requires Microsoft Graph permissions and admin consent
- local admin workflows may still be needed temporarily during transition
- audit readability can degrade if identity normalization is not designed carefully
- token validation should be robust and cached to avoid unnecessary network dependency on every request

## Recommended First Implementation Slice

The safest first delivery is:

1. add Entra config support
2. add backend validation of Entra bearer tokens
3. add frontend Microsoft sign-in
4. keep local login temporarily for fallback
5. map Entra groups/app roles to the three target app roles
6. defer removal of signup/admin flows until Entra access is stable

## Application-Specific Entra Setup

For this billing application, the Entra registration should be configured around the deployed paths already in use:

- frontend base URL: `https://n8n-lan.cwsey.com/billing/`
- backend public API base URL: `https://n8n-lan.cwsey.com/billing-api/`

Recommended app roles:

- `finance_user`
- `billing_user`
- `system_admin`

Recommended API scope:

- `access_as_user`

Recommended frontend redirect URIs:

- `https://n8n-lan.cwsey.com/billing/`
- `http://localhost:5173/` for local development if needed

Recommended post-logout URIs:

- `https://n8n-lan.cwsey.com/billing/`
- `http://localhost:5173/` for local development if needed

## Entra-only validation and rollout strategy

Package 12 makes production authentication Entra-only. Production configuration
fails closed unless backend `AUTH_MODE=entra`; the production frontend must use
`VITE_AUTH_MODE=entra`. Local authentication remains a development/test mode and
is not a production fallback.

### Safety rules

1. validate the candidate against an authorized Entra registration before production
2. use a staging slot or other isolated deployment target where available; do not use live billing data for first-pass authentication validation
3. restrict validation to assigned pilot identities representing each application role plus an unauthorized identity
4. deploy an exact reviewed commit or immutable artifact; do not rebuild a different production artifact after acceptance
5. verify service restart, migration revision and user-visible Entra behavior as separate proofs
6. require Finance/Billing, operational and explicit deployment approvals before production

### Recommended rollout phases

#### Phase A: configuration readiness

- confirm the tenant, application registration, API audience/scope, authority, issuer, JWKS URL and redirect/post-logout URIs
- store values only in the approved deployment secret store
- confirm `AUTH_MODE=entra` and `VITE_AUTH_MODE=entra` are unconditional for production
- confirm required settings fail the deployment before build/restart when absent

#### Phase B: isolated Entra validation

- deploy the exact candidate to an isolated staging target or temporary deployment slot
- test with a small assigned pilot set
- validate:
  - Microsoft redirect and return to `/billing/`
  - `/auth/me` succeeds with a genuine Entra bearer token
  - `finance_user`, `billing_user` and `system_admin` map correctly
  - an unassigned or unauthorized user receives `403`
  - an inactive linked local user receives `401`
  - local-login UI and local-JWT fallback are unavailable in production mode

#### Phase C: business and operational acceptance

Test non-destructive operational paths first:

- overview loads
- approvals and request-settings access match the authenticated role
- audit records identify the correct actor
- navigation does not expose unauthorized operations

Then use controlled test data for approved write operations:

- create a test billing cycle
- generate test scripts only
- do not use live script generation as the first authentication validation step

Record Finance/Billing acceptance, operational acceptance and authentication
acceptance separately. None is implied by successful automated tests.

#### Phase D: production authorization and release

- review the final commit/artifact, CI evidence, staging evidence and acceptance record
- obtain explicit production deployment authorization
- run migrations to the reviewed target revision before service restart
- verify all three production proofs and begin monitored pilot use

### Live verification checklist

After each production deployment, verify:

- `/billing/` loads
- local-login UI is absent
- Microsoft sign-in returns the user to `/billing/`
- `/auth/me` and normal API calls succeed with a genuine Entra bearer token
- `finance_user` cannot access billing-only operations
- `billing_user` cannot access finance-only review actions intended for finance
- `system_admin` can access both operational areas and audit/log views
- service restart time and deployed commit/artifact match the approved release
- `alembic current` matches the reviewed migration revision

### Recovery strategy and rehearsal status

Production must not be switched to local mode. If an Entra-only release causes a
production incident:

1. stop further rollout and preserve diagnostic/audit evidence
2. restore the previous known-good application artifact and its matching approved production configuration
3. confirm database compatibility before any migration downgrade; do not downgrade destructively without separate authorization
4. restart the service and verify service time, migration revision and user-visible behavior
5. escalate tenant/app-registration faults to the authorized Entra administrator

The recovery procedure is defined but its rehearsal is **deferred by decision on
2026-09-09**. It is not completed or passed. A governance owner must confirm
whether a rehearsal or formal exception is mandatory before production; the
deferral must not be treated as production authorization.

## Suggested Branch Strategy

Current working branch:

- `feature/entra-id-auth`

Suggested delivery approach:

1. doc and design updates
2. backend token validation support
3. frontend Microsoft sign-in support
4. role mapping, local user-cache behavior, and audit handling
5. cleanup of local auth/admin flows

## Immediate Next Tasks

1. confirm whether you want Entra groups or Entra app roles to drive authorization
2. confirm whether the backend should validate Entra tokens directly or rely on a gateway pattern
3. add configuration scaffolding and auth service abstraction
4. implement frontend MSAL integration
5. implement local user-cache updates and user-access audit events
6. test the auth flow without touching Nginx paths used by other applications

## Implementation status (2026-07-22, Task 9 of `docs/plans/2026-07-21-revenue-protection-issue-control.md`)

Items 3–5 above are done in code, on `feature/entra-id-auth`, ahead of any
production rollout. This section records what exists so a future session
doesn't have to re-derive it:

- **Backend token validation and dual auth:** `backend/app/services/entra_auth_service.py`
  fetches OpenID config, validates RS256 JWTs via JWKS (issuer/audience/expiry/signature),
  and maps claims to exactly one of `system_admin`/`billing_user`/`finance_user`
  (`roles` claim checked first, falling back to `groups` + the `ENTRA_*_GROUP_ID`
  settings — item 1 above is still an open decision since no real Entra registration
  exists yet to know which claim shape it will actually send). `get_current_actor()`
  in `backend/app/services/auth_service.py` tries local JWT first and only falls
  back to Entra validation when `ENTRA_ENABLED=true`, so local auth is untouched
  while the flag is off (item 2's "direct backend validation" approach, not a gateway).
- **Local user-cache upsert:** `upsert_entra_user()` creates or updates a `users`
  row keyed by `external_subject` (falling back to email match for pre-existing
  local accounts), populating `external_provider`, `last_seen_role`,
  `last_seen_groups`, `last_login_at`, `auth_metadata` — matches this doc's
  "Local User Record Strategy" section exactly. Authorization itself still comes
  from the current token's claims, not the cached row.
- **Frontend MSAL integration:** `frontend/src/entra.js` (raw `@azure/msal-browser`,
  not `@azure/msal-react` — a deliberate deviation, works fine for this app's needs)
  plus a dual-mode `LoginPage.jsx` that shows local login and, only when
  `entra_enabled` is true, a "Sign In With Microsoft" button alongside it.
- **Audit events:** `/auth/me` records a `user_access` audit event regardless of
  `auth_source` (local or `entra_id`), satisfying this doc's "add explicit
  user-access audit events" ask; there's no separate event distinguishing a
  first-time Entra provisioning upsert from an ordinary repeat access — treated
  as an acceptable simplification, not a gap, since the audit row already carries
  `auth_source`.
- **Automated test coverage (new, 2026-07-22):** `backend/tests/test_entra_auth_service.py`
  and `backend/tests/test_entra_dual_auth.py` (12 tests) cover claim-to-role mapping
  and precedence, expired/invalid/malformed-token rejection, the local-user-cache
  upsert/migration-by-email behavior, and the dual-auth fallback end to end through
  `/api/auth/me` (local unaffected when Entra is enabled; Entra path never attempted
  when the flag is off; 403 for a valid Entra actor with a disallowed role). This
  closes the gap called out in commit `8f6d8db`: *"No automated auth test exists yet."*
  Full backend suite: 102/102 passing.
- **CI/CD:** `.github/workflows/ci.yml`'s deploy job already writes all `ENTRA_*`
  backend and `VITE_ENTRA_*` frontend env vars from GitHub secrets, defaulting
  `ENTRA_ENABLED`/`VITE_ENTRA_ENABLED` to `false`. No further CI/CD change was
  made this session — the existing single-shot deploy (build → migrate → restart
  → uptime/`alembic current` proof) already satisfies the plan's "deploy proof"
  requirement for every rollout phase; the phased pilot/rollout itself is an
  Entra-side group/role-assignment decision, not a CI/CD staging mechanism, so
  it doesn't need pipeline changes. Per `CLAUDE.md`, CI/CD is not altered without
  Gregory's explicit approval, and none was needed here.
- **`EXIT.md`:** created at the repo root with the registration-record template
  from `06_ENTRA_ID_INTEGRATION_GUIDE.md` §18 and a rollout-phase checklist
  mirroring this doc's "Recommended rollout phases" — currently all fields are
  `_pending_` because no Azure AD app registration exists yet for this application.

**Status update (2026-07-24):** items 1–3 below are now done. The remaining
gap before Phase A can be meaningfully tested is item 4a (GitHub Actions
secrets) — see below.

1. ~~An actual Entra app registration...~~ **Done 2026-07-23.** Recorded in
   `EXIT.md`'s registration table: tenant ID `97df7dc2-f178-4ce4-b55e-bcafc144485e`,
   client ID `ff645f66-7fab-4907-8ed0-3f232af516f8`, app roles
   (`finance_user`/`billing_user`/`system_admin`) assigned via one security
   group per role in the Enterprise Application.
2. ~~Decide app roles vs. security groups as the claim source~~ **Done —
   resolved as app roles** (see `EXIT.md`; the `roles` claim is the source,
   not `groups`, so no `ENTRA_*_GROUP_ID` secrets are needed).
3. ~~The two long-standing local blockers...~~ **Both done 2026-07-24.**
   Production `alembic stamp head` ran successfully via the
   `stamp-production-db` workflow (`alembic current` confirms `6ab1c9b21c7b
   (head)`); the deploy pipeline is green end-to-end again (migration →
   restart → health check). The local 3-role login smoke test also passed
   against a disposable Postgres (billing/finance/admin all log in via local
   auth, `/auth/me` maps each to the correct role, and role enforcement was
   spot-checked on `/api/issue-reporting/summary`: 403 for billing, 200 for
   finance).
4. **New/still open:** the production deploy job
   (`.github/workflows/ci.yml`) writes `ENTRA_*`/`VITE_ENTRA_*` env vars from
   GitHub Actions secrets, but **no `BILLING_ENTRA_*` secrets exist in the
   repo yet** (`gh secret list` confirms only `BILLING_API_URL`,
   `BILLING_APPROVAL_WEBHOOK_URL`, `BILLING_DATABASE_URL`,
   `BILLING_JWT_*`, `BILLING_N8N_*`). `entra_auth_service.py` and
   `frontend/src/entra.js` both derive `authority`/`issuer`/`audience`/
   `jwks_url`/`redirect_uri`/`api_scope` from tenant ID + client ID alone if
   the more specific vars are unset, so only two backend + two frontend
   secrets are strictly required (see exact values/names in the Hermes log
   and `EXIT.md`). Gregory needs to add these via `gh secret set` or the
   GitHub repo Settings UI — not something to script without his direct
   action per `CLAUDE.md`'s production-config rule.
5. Once 1–4 are done, the actual phased rollout (Phase A–D) is a
   deploy-and-observe exercise against production, which is explicitly out of
   scope to perform without Gregory's direct, in-the-moment approval at each step.

## Implementation status (2026-09-02, RG-01 Package 12A)

Package 12A replaced the Phase 1 dual-auth design above (`ENTRA_ENABLED`
boolean, backend tries local JWT first and falls back to Entra) with a
single explicit authentication-mode contract, ahead of a production Entra
cutover. This section records what changed so a future session doesn't have
to re-derive it; the Phase A–D narrative and the original "Implementation
status (2026-07-22/24)" sections above are left as historical record of the
design that preceded this cutover.

- **`AUTH_MODE` / `VITE_AUTH_MODE` contract:** `backend/app/config.py` adds
  `Settings.auth_mode` (`"local"` default, or `"entra"`) with an
  `is_entra_auth_mode` property; `ENTRA_ENABLED` no longer exists as a
  setting. `frontend/src/entra.js` mirrors this with `VITE_AUTH_MODE` →
  `auth_mode` / `is_entra_auth_mode`; `VITE_ENTRA_ENABLED` no longer exists.
  The mode is a hard either/or, not an additive flag: in `entra` mode local
  auth is entirely unreachable, and in `local` mode Entra is entirely
  unreachable — there is no fallback chain in either direction.
- **Backend fail-closed behavior:** `get_current_actor()` in
  `backend/app/services/auth_service.py` now branches once on
  `settings.is_entra_auth_mode` — Entra mode validates only Entra bearer
  tokens (`_resolve_entra_actor`), local mode validates only local JWTs
  (`_resolve_local_actor`); a stale/forged local JWT is never even attempted
  in Entra mode. `POST /api/auth/login`
  (`backend/app/api/routes/auth.py`) returns `404` in Entra mode without
  checking any username/password or issuing a token. Incomplete Entra
  configuration (missing tenant/client ID) still fails closed with the
  existing `500` "not configured" errors from `entra_auth_service.py` —
  reached directly now instead of through a fallback path.
- **Frontend fail-closed behavior:** `frontend/src/App.jsx` branches on
  `is_entra_auth_mode` at bootstrap. In Entra mode it calls
  `complete_entra_redirect()` (wraps `handleRedirectPromise`), and if there
  is no usable account/token it calls `sign_in_with_entra()` immediately —
  the local `LoginPage` is never rendered in this mode. A
  `sessionStorage` guard (`billing_entra_redirect_guard`) prevents an
  infinite redirect loop: if a redirect round-trip completes without
  producing a usable session, a fail-closed `EntraSignInError` retry surface
  is shown instead of redirecting again automatically. Missing public Entra
  config (`entra_config_error` in `entra.js`) shows the same error surface
  with no retry option and no local fields. `LoginPage.jsx` dropped its
  conditional "Sign In With Microsoft" button — in this mode contract, Entra
  is exclusively an App.jsx-level bootstrap concern, and `LoginPage` only
  renders at all in explicit local mode.
- **Deployment:** `.github/workflows/ci.yml`'s `deploy` job now writes
  `AUTH_MODE=entra` / `VITE_AUTH_MODE=entra` unconditionally (no
  `${{ secrets.BILLING_ENTRA_ENABLED || false }}` fallback that could
  silently produce a local-login production build), and a new "Validate
  required Entra settings are present" step runs after the env files are
  written and before `npm run build`/`alembic upgrade head`/service restart —
  it fails the deploy if `BILLING_ENTRA_TENANT_ID`, `BILLING_ENTRA_CLIENT_ID`,
  `BILLING_ENTRA_API_SCOPE`, or `BILLING_ENTRA_REDIRECT_URI` are unset,
  checking presence only and never printing values. The `test` job's
  backend-tests step now sets `AUTH_MODE: local` explicitly (was previously
  implicit via the default) so CI's isolation from Entra mode is visible in
  the workflow file itself. Host, routes, `/opt/billing`, `billing-api`,
  runner labels, and existing Entra secret names are unchanged.
- **Tests:** `backend/tests/test_entra_dual_auth.py` was rewritten for the
  either/or contract (local-login-in-local-mode, local-JWT-rejected-in-
  entra-mode, entra-only-in-entra-mode, config-incomplete-fails-closed,
  role-gating still applies) in place of the old fallback-chain assertions.
  See `docs/rg01-handoffs/package-12a-latest.md` for the actual run results.
- **Not done in Package 12A (tracked for 12B):** no real Entra network call,
  real credentials, or GitHub secrets change was made or is safe to make
  from this worktree; the actual production cutover (verifying the real
  `BILLING_ENTRA_*` secrets are set, deploying, and running the Phase B/C
  live verification checklist above) remains a Gregory-approved, in-the-
  moment production action, not something this package performs.
