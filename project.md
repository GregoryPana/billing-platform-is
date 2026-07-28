# Billing Collaboration Platform

## Purpose

This project is a billing operations workflow platform for managing monthly billing runs across billing, finance, admin, and viewer roles.

Its core purpose is to:

- create billing cycles for a usage month and billing month pair
- generate backend command scripts for test and live billing runs
- track execution progress of those scripts
- enforce finance approval gates before live billing and notifications
- keep a persistent record of actions, approvals, generated files, and notification commands

At a product level, it replaces a more manual or single-user process with a multi-user web application built around role-based access, workflow controls, and audit visibility.

## What The Product Actually Does

The implemented system is a React frontend backed by a FastAPI API and PostgreSQL database.

The typical business flow is:

1. A billing user creates a billing cycle.
2. Billing generates test scripts for one or more cycle types.
3. The system stores the generated commands and auto-creates planned run records.
4. Billing runs those commands outside the app and marks them as planned, executed, or failed.
5. Billing requests finance approval to move forward.
6. Finance reviews and approves or rejects the request.
7. After test approval, billing can generate live scripts and track live runs.
8. After post-live approval, billing can generate backend notification commands.
9. Users can review approval history, run state, generated commands, notifications, and audit records.

The application does not execute the billing commands itself. It generates, exports, and tracks them.

## Main User Roles

### Billing

- create billing cycles
- generate scripts for test and live environments
- export grouped or full command files
- mark runs as planned, executed, or failed
- request finance approvals
- manage approval request settings
- generate notification commands after post-live approval

### Finance

- review pending approval requests
- approve or reject billing stages
- monitor cycle progress and approval history

### Admin

- all billing-style access
- manage users directly
- review signup requests
- approve or reject account access requests
- view audit logs

### Viewer

- read-only visibility into overview, runs, approvals, request settings, and documentation

## Frontend Design

The frontend is a single-page React application centered almost entirely in `frontend/src/App.jsx`.

### Frontend characteristics

- no client-side router is used
- navigation is controlled by a local `active_view` state
- state is managed with `useState`, `useMemo`, `useEffect`, and `useCallback`
- data is reloaded from the API on login and then polled every 30 seconds
- role-based navigation hides screens that are not available to the current user
- markdown documentation is embedded directly into the UI

### Main screens

- `User Guide`: in-app markdown guide, with PDF export for the billing guide
- `Overview`: summary cards, progress tracker, recent runs, and approvals queue
- `Billing Cycles`: create and list billing cycles
- `Script Generation`: generate commands, set parameters, choose cycle types, export files
- `Runs Tracking`: update run status and request next approval from a run context
- `Approvals`: billing request flow and finance review flow
- `Request Settings`: finance recipient list and default approval request message
- `Notifications`: generate and download backend notification commands
- `Audit Log`: show recorded actions and derived outcomes
- `Documentation`: render the billing process documentation from markdown/PDF
- `Admin`: user management and signup request review

### Frontend UX design choices

- command-centric UI: large focus on generated shell commands and command exports
- workflow visibility: cycle progress tracker appears in overview and run tracking
- role-sensitive experience: finance sees a simplified approval-focused interface
- document-heavy experience: operational guides are part of the product, not separate artifacts
- mostly monolithic implementation: the app is feature-rich, but most of the UI logic lives in one file

## Backend Design

The backend is a FastAPI application under `backend/app`.

### Core backend structure

- `main.py`: creates the FastAPI app, enables CORS, mounts `/api`, exposes `/health`
- `api/routes/`: endpoint modules grouped by domain
- `models/`: SQLAlchemy models for all persisted business entities
- `schemas/`: request and response schemas
- `services/`: workflow, auth, command generation, exports, notifications, and audit helpers
- `db/`: engine, session management, model metadata, and startup database initialization

### API domains

- `auth`: login, current user, signup request submission, signup request approval/rejection
- `cycles`: create and list billing cycles, update cycle status
- `scripts`: generate commands, list scripts, export grouped scripts, export all scripts, download export files
- `runs`: create and update script run records
- `approvals`: request approvals, approve/reject them, manage approval request settings
- `notifications`: generate and store backend notification commands
- `audit`: list audit log records
- `users`: admin-only CRUD-like user management

### Important backend services

#### `auth_service.py`

- hashes and verifies passwords with `passlib`
- creates JWT access tokens
- resolves the current user from a bearer token
- enforces role-based access

#### `workflow_service.py`

- blocks live script actions until test approval exists
- blocks notification generation until post-live approval exists
- validates that all required scripts for a stage have been executed before an approval can be requested

#### `command_service.py`

- defines supported cycle types
- creates default parameter sets for preparation and printing scripts
- validates required values like `p6` for printing
- formats the final backend command line that users execute outside the app

#### `file_export_service.py`

- writes grouped or full command exports to disk
- stores export metadata in the database
- supports later download through the API

#### `notification_service.py`

- builds backend email and SMS notification command text
- currently generates command content only

#### `audit_service.py`

- records audit events for key actions

## Implemented Workflow Rules

The code enforces a smaller and more concrete workflow than some of the docs suggest.

### Enforced gates

- live script generation requires an approved `test` approval
- notification command generation requires an approved `post_live` approval
- approval requests require all related scripts for the target stage to be marked `executed`

### Approval stages in practice

The system stores three stage names:

- `test`
- `live`
- `post_live`

But the actual billing-side request flow in the UI only uses:

- `test` as “Move to live”
- `post_live` as “Move to notifications”

Finance can still manually submit `live` approvals from its review form, but the main workflow logic does not require `live` approval to unlock notifications. The meaningful enforced chain is:

1. test approval
2. live run completion
3. post-live approval
4. notifications

## Data Model

The persisted model is straightforward and workflow-oriented.

### Main tables

- `users`: application users, roles, active flag, password hash
- `approval_request_settings`: global request email settings and default message
- `billing_cycles`: the top-level monthly work unit
- `script_definitions`: generated script commands and parameter sets
- `script_runs`: run status records tied to generated scripts
- `approvals`: finance gate records by cycle and stage
- `generated_files`: metadata for exported command files
- `notifications`: generated notification command records
- `audit_logs`: action history with metadata payloads

### Relationship model

- one billing cycle can have many script definitions
- each script definition gets a run record workflow
- one billing cycle can have approvals for multiple stages
- one billing cycle can have multiple export files and notification records
- audit records are append-only event records tied to actors and entities

## Integrations And External Dependencies

### Database

- PostgreSQL is the main persistent store

### Webhooks

The system uses configurable n8n webhooks for:

- approval request notifications
- approval decision notifications
- signup request notifications
- signup approval notifications

### Billing environment commands

The generated scripts assume an external billing server environment with commands like:

- `/cer_cerprod/exe/pspbil0101b.sh`
- `/cer_cerprod/exe/bil0705s.sh`
- `/cer_cerprod/Dominique/EMAIL_NOTIFICATION_FOR_REAL_BILL_FINAL.sh`
- `/cer_cerprod/Dominique/SMS_NOTIFICATION_FOR_REAL_BILL.sh`

The platform orchestrates these commands operationally, but does not run them automatically.

## Runtime And Deployment Design

### Local development

- frontend runs through Vite
- backend runs through Uvicorn
- Postgres is provided via `docker-compose.yml`

### Production shape

- backend runs as a systemd service using `ops/billing-api.service`
- frontend is built as static assets
- deployment is handled through GitHub Actions on a self-hosted runner

### CI/CD behavior

The GitHub Actions workflow does:

- backend dependency installation
- a Python smoke check using `py_compile`
- frontend dependency installation and production build
- deployment to `/opt/billing` on the self-hosted environment
- environment file generation from GitHub secrets
- backend restart through systemd

There is CI and deployment automation, but there is no real automated test suite yet.

## Architectural Strengths

- clear business workflow mapping between billing and finance
- simple and understandable backend domain structure
- role-based access is applied consistently at route level
- generated files and notifications are persisted, not just transient
- startup seeding and schema bootstrapping make local setup easier
- in-app docs reduce handoff friction for operational users

## Architectural Limitations

- the frontend is heavily concentrated in one very large `App.jsx`, which increases maintenance cost
- there is no migration framework; schema changes are handled with startup-time patching and `create_all`
- audit logging is present but not truly complete across every action
- command defaults are partly duplicated between frontend and backend
- CORS configuration is narrow and environment-specific
- notification generation is command-based only, not a true delivery engine
- there are no automated backend or frontend tests beyond smoke/build checks

## Important Mismatches Between Documentation And Implementation

### API URL mismatch

- `README.md` says the frontend defaults to `http://localhost:8000/api`
- `frontend/src/api.js` actually defaults to `http://localhost:8001/api`
- the production systemd service runs backend Uvicorn on port `8010`

### Approval model mismatch

- docs often describe `test`, `live`, and `post_live` approvals as a full linear model
- implemented gating only materially depends on `test` and `post_live`
- billing UI requests only `test` and `post_live`

### Notification capability mismatch

- docs mention SMTP or n8n notification delivery
- implemented notification behavior generates backend command text and stores it as a record
- there is no actual SMTP sending flow in the current code

### Audit completeness mismatch

- docs imply complete auditability
- the implementation audits many workflow actions, but not all auth and admin actions

### Testing and CI wording mismatch

- README says tests and CI/CD are not set up
- a GitHub Actions CI/deploy workflow is present
- what is actually missing is comprehensive automated test coverage

## Overall Assessment

This is a workflow-driven internal operations platform for billing execution control rather than a billing engine itself.

The product is strongest where it turns a manual operational process into a structured sequence:

- cycle creation
- command generation
- run tracking
- finance gating
- notification preparation
- audit visibility

The codebase already implements the essential business workflow end to end. Its biggest technical debt is not missing functionality, but consolidation and polish:

- the frontend needs decomposition
- the backend would benefit from migrations and deeper tests
- docs should be updated to match actual behavior

## Short Functional Summary

If reduced to one sentence:

This application helps billing teams generate and track monthly backend billing commands, obtain finance approvals at control points, and preserve an operational record of the full billing run lifecycle.
