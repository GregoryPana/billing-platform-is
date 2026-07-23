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
- `ENTRA_ENABLED`
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

Treat `signup_requests` as legacy after Entra onboarding becomes the standard path.

Recommended later actions:

- stop creating new signup requests
- leave historical rows intact
- remove UI and API after cutover

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

## Testing Strategy Without Separate Environments

Because this repository deploys directly from `main` to the live VM, testing must be staged functionally inside the application rather than by using separate infrastructure.

### Safety rules

1. keep Entra auth behind explicit feature flags until validation is complete
2. keep local login available during the migration period
3. avoid removing existing auth flows until Entra sign-in is proven in production
4. deploy small reversible increments
5. validate auth using a limited pilot group before broad rollout

### Recommended rollout phases

#### Phase A: passive backend support

- deploy backend Entra validation code with `ENTRA_ENABLED=false`
- confirm local auth still works unchanged
- verify startup, health, and normal workflow behavior

#### Phase B: controlled Entra enablement

- set backend and frontend Entra env vars
- keep local login visible
- test with a very small pilot set of assigned users
- validate:
  - sign-in succeeds
  - `/auth/me` succeeds with Entra token
  - correct role is derived
  - unauthorized users receive `403`
  - existing local users can still work if rollback is needed

#### Phase C: business workflow testing

Test with non-destructive operational paths first:

- overview loads
- approvals screen access is correct by role
- request settings access is correct by role
- audit log shows user access events
- no unexpected role leakage appears in navigation

Then test controlled write operations:

- create a test billing cycle
- generate test scripts only
- do not use live script generation as the first auth validation step

#### Phase D: cutover planning

- once Entra login is stable, decide a date to hide local sign-in from normal users
- only after a stable period should signup requests and local admin onboarding be retired

### Live verification checklist

After each production deployment, verify:

- `/billing/` loads
- existing local login still works if expected
- Microsoft sign-in button appears only when Entra is enabled
- Entra sign-in returns the user to `/billing/`
- API calls succeed with Entra bearer token
- `finance_user` cannot access billing-only operations
- `billing_user` cannot access finance-only review actions intended for finance
- `system_admin` can access both operational areas and audit/log views

### Rollback strategy

If Entra rollout causes production issues:

1. turn `VITE_ENTRA_ENABLED=false`
2. turn `ENTRA_ENABLED=false`
3. redeploy
4. continue operating with local auth while investigating

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

**What is still genuinely outstanding before any production Entra rollout phase
can start** (all require Gregory's/IT's direct action, not further code):

1. An actual Entra app registration (tenant ID, client ID, redirect URLs, app
   roles or groups) has to be created in Azure AD — nothing above simulates or
   assumes one exists. Fill in `EXIT.md`'s registration table once it is.
2. Decide app roles vs. security groups as the claim source (Immediate Next
   Task 1, still open) — informs which `ENTRA_*_GROUP_ID` secrets, if any, get set.
3. The two long-standing local blockers unrelated to Entra itself: production's
   `alembic stamp head` (see `docs/DEPLOYMENT_SAFETY.md`) and the local 3-role
   login smoke test — both still open, tracked in the plan tracker's Handover section.
4. Once 1–3 are done, the actual phased rollout (Phase A–D) is a
   deploy-and-observe exercise against production, which is explicitly out of
   scope to perform without Gregory's direct, in-the-moment approval at each step.
