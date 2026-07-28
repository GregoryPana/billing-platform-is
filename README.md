# Billing Collaboration Platform

## Overview

The Billing Collaboration Platform is an internal workflow application for monthly billing operations.

It helps teams:

- create billing cycles
- generate backend billing commands for test and live runs
- track whether those commands were executed successfully
- request and record finance approvals at control points
- generate notification command sets after billing is complete
- retain a persistent operational history in Postgres

This system does not execute billing commands itself. It generates, exports, and tracks them.

## Implemented Workflow

1. Billing creates a billing cycle.
2. Billing generates test scripts for one or more cycle types.
3. The system stores those commands and creates planned run records.
4. Billing runs the commands outside the app and updates run status.
5. Billing requests finance approval to move to live.
6. Finance approves or rejects that request.
7. Billing generates and tracks live scripts.
8. Billing requests finance approval to move to notifications.
9. After approval, billing generates backend notification commands.

## Roles

- `billing`: create cycles, generate scripts, track runs, request approvals, manage request settings, generate notifications
- `finance`: review and approve or reject requests
- `admin`: manage users and signup requests, plus broader platform visibility
- `viewer`: read-only access to selected screens

## Current Feature Set

### Frontend

- login with username or email plus password
- signup request flow for new users
- role-based navigation
- overview dashboard with cycle progress tracker
- billing cycle creation
- script generation for `test` and `live`
- run status tracking per generated script
- approval request submission to finance recipients
- finance review and decision workflow
- request settings for approval recipients and default message
- notification command generation and download
- embedded documentation and billing process reference
- admin user management and signup request review

### Backend

- JWT authentication
- role-protected REST endpoints under `/api`
- Postgres persistence with SQLAlchemy models
- live-generation gate requiring approved test stage
- notification gate requiring approved post-live stage
- grouped and full script exports written to disk
- audit event storage for key workflow actions
- n8n webhook integration for approval and signup notifications

## Architecture

### Stack

- frontend: React 19 + Vite
- backend: FastAPI + SQLAlchemy
- database: PostgreSQL 16
- auth: local JWT-based authentication
- deployment: GitHub Actions + self-hosted runner + systemd

### Repository layout

```text
.
├── architecture/
│   └── blueprint.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   └── main.py
│   └── requirements.txt
├── docs/
│   └── platform/
├── frontend/
│   ├── src/
│   └── package.json
├── ops/
│   └── billing-api.service
├── docker-compose.yml
├── project.md
└── README.md
```

### Important implementation notes

- the frontend is currently a single large app centered in `frontend/src/App.jsx`
- the backend creates tables on startup; there is no migration framework yet
- CORS is currently configured only for `http://localhost:5173`
- export files are written relative to the backend working directory, which means runtime exports end up under `backend/backend/exports/` when the backend is started from `backend/`

## API Summary

All application endpoints are mounted under `/api`.

### Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/signup`
- `GET /auth/requests`
- `POST /auth/requests/{request_id}/approve`
- `POST /auth/requests/{request_id}/reject`

### Cycles

- `GET /cycles/`
- `POST /cycles/`
- `PATCH /cycles/{cycle_id}/status`

### Scripts

- `GET /scripts/`
- `POST /scripts/generate`
- `POST /scripts/export`
- `POST /scripts/export-all`
- `GET /scripts/exports/{export_id}/download`

### Runs

- `GET /runs/`
- `POST /runs/`
- `PATCH /runs/`

### Approvals

- `GET /approvals/`
- `POST /approvals/`
- `POST /approvals/request`
- `GET /approvals/settings`
- `PUT /approvals/settings`

### Notifications

- `GET /notifications/`
- `POST /notifications/`

### Audit

- `GET /audit/`

### Users

- `GET /users/`
- `POST /users/`
- `PATCH /users/{user_id}`
- `DELETE /users/{user_id}`

### Health

- `GET /health`

## Workflow Gates

The implementation currently enforces these rules:

- live script generation requires an approved `test` approval
- notification command generation requires an approved `post_live` approval
- approval requests require all scripts for the relevant stage to be marked `executed`

The codebase contains `test`, `live`, and `post_live` approval stage values, but the main billing workflow in the UI uses only:

- `test` for move-to-live
- `post_live` for move-to-notifications

Finance can still manually record a `live` approval in its review form, but it is not the main gate used by the billing-side request flow.

## Data Model

Main tables:

- `users`
- `approval_request_settings`
- `billing_cycles`
- `script_definitions`
- `script_runs`
- `approvals`
- `generated_files`
- `notifications`
- `audit_logs`

## Configuration

### Backend environment variables

- `APP_NAME`
- `ENVIRONMENT`
- `DATABASE_URL`
- `TIMEZONE_OFFSET_HOURS`
- `N8N_WEBHOOK_URL`
- `N8N_APPROVAL_WEBHOOK_URL`
- `N8N_SIGNUP_WEBHOOK_URL`
- `N8N_SIGNUP_APPROVE_WEBHOOK_URL`
- `N8N_WEBHOOK_VERIFY`
- `JWT_SECRET`
- `JWT_EXP_MINUTES`

### Frontend environment variables

- `VITE_API_URL`
- `VITE_APPROVAL_WEBHOOK_URL`

## Local Development

### Requirements

- Node.js 18+
- Python 3.11+
- Docker

### Start Postgres

```bash
docker-compose up -d
```

The provided compose file maps host port `5435` to container port `5432`.
If you use the compose database locally, set `DATABASE_URL` accordingly.

Example:

```env
DATABASE_URL=postgresql+psycopg://billing:billing@localhost:5435/billing
```

### Start backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Start frontend

```bash
cd frontend
npm install
npm run dev
```

### Local frontend API default

If `VITE_API_URL` is not set, the frontend currently defaults to:

```text
http://localhost:8001/api
```

That default does not match the README used previously, so set `VITE_API_URL` explicitly for local work if needed.

## Default Seed Users

Created automatically when the user table is empty:

- `billing_user / ChangeMe123!`
- `finance_user / ChangeMe123!`
- `admin / AdminChange2026!`
- `viewer / ChangeMe123!`

Change these outside local development.

## Deployment

The repository indicates a current production-style deployment on a Linux VM.

### Runtime locations from repo config

- app root: `/opt/billing`
- backend working directory: `/opt/billing/backend`
- backend env file: `/opt/billing/backend/.env`
- frontend env file: `/opt/billing/frontend/.env.production`
- frontend build output: `/opt/billing/frontend/dist`
- systemd unit name: `billing-api`

### Runtime process

The backend is configured to run as:

```text
/opt/billing/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

### CI/CD

GitHub Actions does the following:

- runs backend dependency installation and a Python smoke check
- installs frontend dependencies and builds the production bundle
- deploys on a self-hosted runner labeled `billing`
- keeps the checked-out repo at `/opt/billing`
- rewrites env files from GitHub secrets
- restarts `billing-api`

### Reverse proxy expectation

The docs and workflow imply an Nginx reverse proxy in front of the app, with paths similar to:

- UI: `/billing/`
- API: `/billing-api/`

## Current Known Gaps

- no automated backend or frontend test suite yet
- no migration framework yet
- audit logging is partial, not exhaustive
- notification generation stores backend command text rather than executing or delivering notifications
- frontend logic is concentrated in one large file and could be decomposed later

## Documentation

- high-level implementation summary: `project.md`
- architecture notes: `architecture/blueprint.md`
- deployment notes: `docs/github-deployment-guide.md`
- billing process references: `docs/platform/`
