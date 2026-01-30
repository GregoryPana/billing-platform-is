# Billing Collaboration Platform

## 1. Project Overview
The Billing Collaboration Platform is a web application for creating billing command scripts, tracking execution, and enforcing finance approvals before moving to live runs and notifications. It replaces the prior Streamlit stack with a React + FastAPI + Postgres architecture to support multiple users, role-based access, and auditability.

**Problems it solves**
- Manual script creation and execution tracking
- Missing approval gates between billing and finance
- Limited visibility into run status and audit history

**Primary users**
- Billing users who create cycles, generate scripts, and record runs
- Finance users who review and approve test/live/post-live stages
- Admin users who manage access and oversight
- Viewer users who need read-only visibility

## 2. Key Features
**Frontend**
- Role-based navigation for billing, finance, admin, and viewer users
- Dashboard with cycle status, approvals, and run summaries
- Tables for script runs and approvals queue, filtered by cycle, environment, and script type

**Backend**
- FastAPI endpoints for cycles, scripts, runs, approvals, notifications, and audit logs
- Approval gates to prevent live actions without test approval
- Script generation auto-creates planned run records per cycle type
- Billing can request finance approvals only after required test/live runs are executed
- UTC+4 timezone handling for all timestamps
- Global approval request settings (recipients + default message) stored in Postgres

**Data**
- Postgres schema for users, cycles, scripts, runs, approvals, notifications, and audit logs
- JSON parameters stored for each script definition

**Integrations**
- SMTP (planned) or n8n webhook (optional) for notifications

## 3. System Architecture
**High-level flow**
React frontend calls the FastAPI backend, which persists data in Postgres. The backend validates workflow gates and writes audit records for every action. File exports and notification delivery are handled server-side.

**Components**
- React UI: role-based screens, status cards, tables
- FastAPI API: workflow and validation logic
- Postgres: source of truth for all records

**Data flow**
1. Billing creates a cycle and generates test scripts.
2. Script generation creates planned run records for each cycle type.
3. Billing marks runs executed/failed and requests finance approval.
4. Finance approves test stage, enabling live script generation.
5. Billing marks live runs and requests post-live approval.
6. Finance approves post-live, enabling notifications and closure.

## 4. Tech Stack
- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy
- Database: Postgres 16
- Styling: Custom CSS following `ui-styling-guide.md`
- Runtime: Uvicorn

## 5. Project Structure
```
.
├── architecture/
│   └── blueprint.md          # Workflow and approval design
├── backend/
│   ├── app/
│   │   ├── api/               # API routers
│   │   ├── db/                # Database session + init
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Workflow + audit services
│   │   ├── utils/             # Datetime utilities
│   │   └── main.py            # FastAPI entrypoint
│   └── requirements.txt
├── docs/
│   └── platform/              # In-app documentation
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   └── package.json
├── .env.example
├── docker-compose.yml
└── README.md
```

## 6. Frontend
**Entry points**
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

**Documentation content**
- `docs/platform/billing_process.md`
- `docs/platform/Bill_Notifications_EMAIL_SMS.md`

**Main flows**
- Overview dashboard for billing activity and approvals
- Runs tracking table filtered by cycle/environment/script type and approval queue

**State management**
- React component state (scaffolded)

**Backend communication**
- Planned via REST calls to `/api/*`

**Environment variables**
- `VITE_API_URL` (optional, defaults to `http://localhost:8000/api`)
  - Production uses GitHub Actions secrets to generate `/opt/billing/frontend/.env.production`.

## 7. Backend
**Entry points**
- `backend/app/main.py`

**Core logic**
- Workflow gate checks in `backend/app/services/workflow_service.py`
- Command parameter defaults in `backend/app/services/command_service.py`
- Audit logging in `backend/app/services/audit_service.py`

**Data access**
- SQLAlchemy models in `backend/app/models/`

**Environment variables**
- Local: `backend/.env.local`
- Production: `backend/.env`
- `DATABASE_URL` (psycopg3 driver)
- `TIMEZONE_OFFSET_HOURS`
- `N8N_WEBHOOK_URL`
- `N8N_APPROVAL_WEBHOOK_URL`
- `N8N_SIGNUP_WEBHOOK_URL`
- `N8N_WEBHOOK_VERIFY` (set `false` only for self-signed certs in dev)
- `JWT_SECRET`
- `JWT_EXP_MINUTES`
  - Production values are written from GitHub Actions secrets on each deploy.

## 8. API Reference
All endpoints are under `/api`.

**Cycles**
- `GET /cycles` → list cycles
- `POST /cycles` → create cycle
  - Body: `{ "usage_month": "YYYY-MM", "billing_month": "YYYY-MM", "notes": "..." }`
- `PATCH /cycles/{cycle_id}/status` → update status
  - Body: `{ "status": "draft|test_in_progress|test_approved|live_in_progress|live_approved|post_live_approved|closed" }`

**Scripts**
- `GET /scripts` → list script definitions
- `POST /scripts/generate` → generate scripts
  - Body: `{ "billing_cycle_id": "uuid", "environment": "test|live", "script_type": "preparation|printing", "log_types": ["I1A"], "overrides": {"p6": "..."} }`
  - Errors: 400 if live actions without test approval or missing p6 for printing
- `POST /scripts/export` → export grouped command file
  - Body: `{ "billing_cycle_id": "uuid", "environment": "test|live", "script_type": "preparation|printing" }`
  - Response includes `file_name` and `file_path`
- `POST /scripts/export-all` → export all commands for a billing run
  - Body: `{ "billing_cycle_id": "uuid" }`
  - Response includes `file_name` and `file_path`
- `GET /scripts/exports/{export_id}/download` → download grouped command file

**Runs**
- `GET /runs` → list script runs
- `POST /runs` → create a run record
  - Body: `{ "script_definition_id": "uuid", "status": "planned|executed|failed", "notes": "..." }`
- `PATCH /runs` → update run status
  - Body: `{ "script_run_id": "uuid", "status": "planned|executed|failed", "notes": "..." }`

**Approvals**
- `GET /approvals` → list approvals
- `POST /approvals` → create/update approval
  - Body: `{ "billing_cycle_id": "uuid", "stage": "test|live|post_live", "status": "approved|rejected", "comments": "..." }`
- `POST /approvals/request` → request approval (billing)
  - Body: `{ "billing_cycle_id": "uuid", "stage": "test|post_live", "comments": "..." }`
- `GET /approvals/settings` → get global approval settings (billing/admin)
- `PUT /approvals/settings` → update global approval settings
  - Body: `{ "billing_email": "...", "default_message": "...", "finance_recipients": ["..."] }`

**Approval webhook payload (n8n)**
```json
[
  {
    "body": {
      "recipients": ["finance@example.com"],
      "billing_email": "information-system@cwseychelles.com",
      "requested_by": "Billing User",
      "timestamp": "2026-01-26T07:38:28.974Z",
      "cycle": "Mar 2026 - Mar 2026",
      "approval_request": "Request to Send Billing Notifications",
      "message": "Please approve the requested."
    }
  }
]
```

**Approval response webhook payload (n8n)**
```json
[
  {
    "body": {
      "finance_email": "finance@example.com",
      "finance_name": "Finance User",
      "billing_email": "information-system@cwseychelles.com",
      "timestamp": "2026-01-26T07:38:28.974Z",
      "cycle": "Mar 2026 - Mar 2026",
      "approval_request": "Request to Send Billing Notifications",
      "decision": "approved",
      "comment": "Approved to proceed"
    }
  }
]
```

**Signup request webhook payload (n8n)**
```json
[
  {
    "body": {
      "username": "new_user",
      "name": "New User",
      "email": "new_user@example.com",
      "timestamp": "2026-01-26T07:38:28.974Z",
      "admin_email": "admin@example.com"
    }
  }
]
```

**Notifications**
- `GET /notifications` → list notifications
- `POST /notifications` → queue notification
  - Body: `{ "billing_cycle_id": "uuid", "channel": "smtp|n8n", "recipient": "...", "subject": "...", "message": "..." }`
  - Errors: 400 if post-live approval missing

**Audit**
- `GET /audit` → list audit events

**Users**
- `GET /users` → list users (admin only)

**Authentication**
- JWT bearer token from `/auth/login`
- Signup requests require `name`, `username`, `email`, and `password`.

**Default users (seeded)**
- billing_user / ChangeMe123!
- finance_user / ChangeMe123!
- admin / AdminChange2026!
- viewer / ChangeMe123!

Change these passwords after first login.

## 9. Data Model
Tables (draft):
- `users` (includes required `name`)
- `signup_requests`
- `approval_request_settings`
- `billing_cycles`
- `script_definitions`
- `script_runs`
- `approvals`
- `generated_files`
- `notifications`
- `audit_logs`

Seed users are created on startup with fixed UUIDs for local development:
- billing_user: `00000000-0000-0000-0000-000000000001`
- finance_user: `00000000-0000-0000-0000-000000000002`
- admin: `00000000-0000-0000-0000-000000000003`
- viewer: `00000000-0000-0000-0000-000000000004`

## 10. Local Development
**Requirements**
- Node.js 18+
- Python 3.11+
- Docker (for Postgres)

**Setup**
1. Start Postgres:
   ```bash
   docker-compose up -d
   ```
2. Backend setup:
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
   The API auto-creates tables on startup.
3. Frontend setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

**Frontend configuration**
- Local: `frontend/.env.local`
- Production build: `frontend/.env.production`

Create one of the following as needed:
```
VITE_API_URL=http://localhost:8000/api
VITE_APPROVAL_WEBHOOK_URL=https://n8n-lan.cwsey.com:8443/webhook-test/billing-approval-request
```

## 11. Testing
Not implemented yet. Planned: pytest for API tests and Vitest/Playwright for UI.

## 12. Deployment
### Self-hosted VM deployment
Target: `/opt/billing` on the Ubuntu VM.

**Backend service (systemd)**
- Install `ops/billing-api.service` to `/etc/systemd/system/billing-api.service`
- Enable and start:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable --now billing-api
  ```

**Environment files**
- Backend (production): `/opt/billing/backend/.env`
- Frontend (production build): `/opt/billing/frontend/.env.production`

**Nginx (example)**
- API: `/billing-api/` → `http://localhost:8010/`
- UI: `/billing/` → `/opt/billing/frontend/dist/`

**GitHub Actions deploy**
- Uses the self-hosted runner to pull to `/opt/billing`, write env files, build the frontend, and restart `billing-api`.

**Deployment visibility requirement (planned)**
- App name
- Version or commit hash
- Deploy timestamp
- Environment
- Health status

**Environment contract (planned)**
- Runtime user: TBD
- Ports: API `8000`, UI `5173`, Postgres `5432`
- Volumes: Postgres data volume (docker)
- External dependencies: Postgres, SMTP or n8n
- Restart policy: TBD

## 13. CI/CD
GitHub Actions workflow: `.github/workflows/ci.yml`

- Runs backend dependency install and smoke check
- Builds the frontend
- Deploy job (manual trigger) emits deployment visibility metadata:
  - app name
  - version/commit hash
  - deploy timestamp (UTC)
  - environment
  - health status

## 14. Operations and Monitoring
Not applicable. No monitoring or health dashboards are wired up yet.

## 15. Common Errors and Fixes
- **Unauthorized**: Login to get a bearer token and include `Authorization: Bearer <token>`.
- **Live action blocked**: Finance test approval must be recorded first.
- **Notification blocked**: Post-live approval must be recorded first.
- **Passlib bcrypt error on startup**: Ensure `bcrypt<4.1` is installed (required by `passlib`).

## 16. Change Guide
- **Add a new cycle type**: update UI list and backend generation defaults in `backend/app/services/command_service.py`.
- **Update approval stages**: update `backend/app/services/workflow_service.py` and cycle statuses.
- **Add a new role**: update role checks in `backend/app/services/auth_service.py`.

## 17. Glossary
- **Billing Cycle**: Pair of usage and billing months for script generation.
- **Preparation Script**: Initial script run to prepare billing data.
- **Printing Script**: Second-phase script that generates bills.
- **Post-Live Approval**: Finance approval required before notifications.

## 18. Known Gaps
- Authentication is header-based placeholder only.
- Bulk run updates are not implemented.
- Notification delivery uses SMTP or n8n based on configuration, but retries and async processing are not implemented.
- Tests and CI/CD are not set up.

## 19. License
Not specified.

## 20. User Guide
1. **Overview**: Review the active cycle, pending approvals, and recent runs.
2. **Billing Cycles**: Create a cycle with usage/billing months.
3. **Script Generation**: Generate test scripts first; live scripts require finance approval.
4. **Runs Tracking**: Select a cycle and mark scripts as planned, executed, or failed to keep audit history.
5. **Approvals**: Billing requests approvals after runs are executed; finance reviews pending requests.
6. **Notifications**: After post-live approval, queue notifications for distribution.
7. **Audit Log**: Review all actions recorded by user or system.
