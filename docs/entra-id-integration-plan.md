# Entra ID Integration Plan

## Goal

Replace the current local username/password and signup-approval model with Microsoft Entra ID authentication, while preserving the billing workflow, approvals, and deployment paths.

This should eventually remove or greatly reduce the need for:

- local signup requests
- admin approval of new user access
- local password storage
- manual user creation for normal access onboarding

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

## Recommended Role Strategy

Use Entra group or app-role claims as the source of authorization.

Recommended mapping:

- Entra billing group/app role -> `billing`
- Entra finance group/app role -> `finance`
- Entra admin group/app role -> `admin`
- Entra viewer group/app role -> `viewer`

This is preferable to email-based mapping because it is centrally manageable and easier to audit.

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
  - user id or subject
  - display name
  - email or preferred username
  - mapped app role
- optionally upsert a local `users` row for audit readability and continuity

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

Admin may still remain if the app needs:

- read-only visibility into users
- exceptional role overrides
- operational support tools

But if Entra groups fully own access, the admin surface can shrink significantly.

## Backend Work Plan

### 1. Add configuration

Add settings such as:

- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_API_AUDIENCE`
- `ENTRA_AUTHORITY`
- `ENTRA_ENABLED`
- `ENTRA_ALLOWED_GROUP_IDS`

### 2. Add token validation service

Add a new backend service, for example:

- `backend/app/services/entra_auth_service.py`

Responsibilities:

- fetch OpenID configuration
- fetch JWKS signing keys
- validate JWT signature and claims
- normalize user claims
- extract roles or groups

### 3. Update auth dependency

Refactor `auth_service.py` so authorization can support:

- local JWTs during migration
- Entra tokens during and after migration

Prefer a small abstraction like:

- `resolve_current_identity()`
- `map_identity_to_actor()`

### 4. Decide how much of `users` remains

Recommended minimal retention:

- keep `users` for audit display and optional local metadata
- stop using it as the primary credential store
- treat `password_hash` as legacy once local auth is removed

Potential schema additions:

- `external_provider`
- `external_subject`
- `display_name`

### 5. Update audit behavior

Audit records should continue to show meaningful actors after Entra migration.

Recommended:

- store actor email/display name where helpful in metadata
- preserve stable actor identifiers from Entra `sub` or object ID claims

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

Existing users can be preserved.

Recommended approach:

- match users by email or username during transition
- backfill external identity fields on first successful Entra login
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
- local admin workflows may still be needed temporarily during transition
- audit readability can degrade if identity normalization is not designed carefully
- token validation should be robust and cached to avoid unnecessary network dependency on every request

## Recommended First Implementation Slice

The safest first delivery is:

1. add Entra config support
2. add backend validation of Entra bearer tokens
3. add frontend Microsoft sign-in
4. keep local login temporarily for fallback
5. map Entra groups/app roles to current app roles
6. defer removal of signup/admin flows until Entra access is stable

## Suggested Branch Strategy

Current working branch:

- `feature/entra-id-auth`

Suggested delivery approach:

1. doc and design updates
2. backend token validation support
3. frontend Microsoft sign-in support
4. role mapping and user migration handling
5. cleanup of local auth/admin flows

## Immediate Next Tasks

1. confirm whether you want Entra groups or Entra app roles to drive authorization
2. confirm whether the backend should validate Entra tokens directly or rely on a gateway pattern
3. add configuration scaffolding and auth service abstraction
4. implement frontend MSAL integration
5. test the auth flow without touching Nginx paths used by other applications
