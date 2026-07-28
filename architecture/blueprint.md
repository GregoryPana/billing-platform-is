# Blueprint: Billing Collaboration Platform

## Goal

Provide a shared web workflow for billing operations so billing and finance teams can coordinate monthly billing runs with approvals, traceability, and persistent records.

## Implemented Scope

- React frontend for billing, finance, admin, and viewer roles
- FastAPI backend with JWT auth and role checks
- Postgres persistence for cycles, scripts, runs, approvals, notifications, users, and audit logs
- export of generated billing commands to server-side files
- n8n webhook integration for approval and signup notifications
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

- `admin`: manage users and signup requests, plus wider system visibility
- `billing`: create cycles, generate scripts, track runs, request approvals, generate notifications
- `finance`: review and approve or reject requests
- `viewer`: read-only access to selected operational views

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

- `auth`: login, current user, signup requests, signup approval/rejection
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

- backend schema is created on startup; migrations are not yet implemented
- CORS is currently limited to local frontend development origin
- export directory is relative to the backend working directory
- the frontend is mostly implemented in a single `App.jsx`

## Next Logical Evolution

The current architecture is a strong fit for adding enterprise authentication later.

If Microsoft Entra ID replaces local authentication, likely follow-on changes would include:

- removing local signup and admin approval flows
- replacing JWT/password login with Entra-backed identity tokens or delegated auth
- mapping Entra identities or groups to app roles
- simplifying or removing local user administration screens
