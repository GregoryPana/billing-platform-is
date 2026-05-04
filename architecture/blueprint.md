# Blueprint: Billing Collaboration Platform

## Goal
Create a web platform to generate billing command scripts, track executions, enforce finance approvals, and maintain a complete audit trail.

## Scope
- React frontend for billing, finance, admin, and viewer roles
- FastAPI backend with Postgres for persistence
- File export for grouped command outputs
- Notifications via SMTP (default) or n8n webhook (optional)

## Roles and Permissions
- admin: full access, user management
- billing: create cycles, generate scripts, record runs, request approvals
- finance: review and approve test/live/post-live stages
- viewer: read-only visibility across cycles, runs, approvals

## Approval Gates
1. Billing generates test scripts and records test runs.
2. Finance approves test stage before live scripts can be generated or executed.
3. Billing generates live scripts and records live runs.
4. Finance approves post-live stage before notifications are sent.
5. After post-live approval and notification, cycle can be closed.

## Data Flow (High Level)
1. User creates billing cycle (usage month + billing month).
2. Billing generates script definitions with parameters and commands.
3. Billing updates run status for each script.
4. Finance reviews and approves stages.
5. System generates grouped output files.
6. Notifications are sent and recorded.
7. All actions recorded in audit log.

## API Modules (Planned)
- auth: login, session, role checks
- cycles: create/list/update status
- scripts: generate/list/export
- runs: update status, bulk updates
- approvals: submit/review/approve/reject
- notifications: send, history
- audit: list events
- users: admin-managed users

## Validation Rules
- Enforce role checks at every endpoint
- Reject live generation without test approval
- Reject notifications without post-live approval
- Require billing_run_uid for printing scripts
- Validate month formats (YYYY-MM)
- Track timestamps in UTC+4

## Deliverables
- Frontend app with role-based navigation
- Backend API with OpenAPI docs
- Postgres schema and migrations
- Local dev setup with docker-compose for Postgres
- README with user guide and developer setup
