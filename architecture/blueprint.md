# Blueprint: Billing Collaboration Platform

## Goal

Provide a shared web workflow for billing operations so billing and finance teams can coordinate monthly billing runs with approvals, traceability, and persistent records.

## Implemented Scope

- React frontend for billing, finance, and admin roles
- FastAPI backend with Entra ID as the primary auth path, a local break-glass fallback, and role checks
- Postgres persistence for cycles, scripts, runs, approvals, notifications, users, and audit logs
- export of generated billing commands to server-side files
- n8n webhook integration for approval notifications
- command generation for billing and notification steps executed outside the app

## Product Boundaries

The platform does not directly execute Cerillion billing commands.

It is responsible for:

- generating commands
- storing command definitions
- tracking run status
- enforcing approval gates
- generating downloadable command bundles
- recording workflow history

## Roles

The backend accepts exactly three effective roles (`backend/app/services/auth_service.py:16-29`); any other value is rejected by `normalize_role` with 403 Unknown role:

- `system_admin` (stored as `admin`): manage users, plus wider system visibility
- `billing_user` (stored as `billing`): create cycles, generate scripts, track runs, request approvals, generate notifications
- `finance_user` (stored as `finance`): review and approve or reject requests

There is no `viewer` role. Legacy `viewer` accounts are explicitly deactivated at startup (`backend/app/db/init_db.py:80`).

## Current Workflow

1. Billing creates a cycle.
2. Billing generates test scripts.
3. The system creates planned run records.
4. Billing executes commands externally and marks run results in the app.
5. Billing requests finance approval to move to live.
6. Finance approves or rejects.
7. Billing generates and tracks live scripts.
8. Billing requests finance approval to move to notifications.
9. Finance approves or rejects.
10. Billing generates notification command text and can download it.

## Enforced Approval Gates

- live script generation is blocked until `test` approval is approved
- notification generation is blocked until `post_live` approval is approved
- an approval request is blocked until all scripts for that stage are marked `executed`

## Approval Stage Model

The data model allows these approval stages:

- `test`
- `live`
- `post_live`

The main billing workflow currently uses:

- `test` for move-to-live
- `post_live` for move-to-notifications

The finance review form can still submit `live`, but it is not the main gate used by the billing-side request flow.

## Main Backend Modules

- `auth`: login, current user (Entra ID primary, local break-glass fallback; no signup flow)
- `cycles`: create, list, update cycle status
- `scripts`: generate, list, export, download
- `runs`: create and update run records
- `approvals`: request approvals, approve/reject, manage settings
- `notifications`: generate notification command records
- `audit`: list audit events
- `users`: admin user management

## Main Persistence Entities

- `users`
- `approval_request_settings`
- `billing_cycles`
- `script_definitions`
- `script_runs`
- `approvals`
- `generated_files`
- `notifications`
- `audit_logs`

## Technical Constraints

- schema changes are managed with Alembic (`backend/alembic/versions/`, 4 migrations, exactly one head)
- CORS is currently limited to local frontend development origin
- export directory is relative to the backend working directory
- `frontend/src/App.jsx` is a 154-line routing shell (react-router-dom); feature logic lives in `frontend/src/features/*` page components

## Entra ID Integration Status

Microsoft Entra ID is now the primary authentication path (see `docs/entra-id-integration-plan.md` for the integration plan). `backend/app/services/auth_service.py:get_current_actor` tries local token validation first, then falls back to Entra when `settings.entra_enabled`. The local signup and admin-approval flow has been removed; only one local break-glass admin account remains, seeded at startup and not exposed via any signup path.
