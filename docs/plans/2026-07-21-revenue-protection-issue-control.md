# Revenue Protection Issue Control Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add cycle-scoped Finance bill-review issue controls, read-only Billing visibility, rare run-level execution issues, and Finance-only post-live observations while preserving the controlled monthly billing workflow.

**Architecture:** Introduce an auditable issue aggregate linked primarily to a billing cycle and context, with an optional script-run reference. Finance test-review issues are a hard precondition for Move to Live approval; execution issues retain run-level operational context; post-live observations are history-only. Use append-only activity and audit events rather than a mutable notes-only record.

**Tech stack:** FastAPI, SQLAlchemy, PostgreSQL, Alembic (to introduce before the new schema), React/Vite, existing Tailwind token system and shadcn-style project primitives, GitHub Actions, Microsoft Entra ID.

---

## Scope and non-negotiable rules

- This application coordinates around Cerillion; it must not execute Cerillion/billing commands automatically.
- Target roles are exactly `billing_user`, `finance_user`, and `system_admin`. Retire `viewer` through the Entra cutover plan; do not add a replacement role.
- Finance test-review issues belong to one monthly cycle and are not assigned, carried over, or managed as a general backlog.
- Billing may create execution issues against a run and read Finance issues, but only Finance/Admin can create, edit, complete, invalidate, reopen, or approve Finance review issues.
- Finance test-review issues block Move to Live while status is `open`.
- Finance completion outcome is either `resolved` or `raised_in_error`; the latter requires a comment and remains auditable but is excluded from headline KPI reporting.
- Post-live observations are Finance/Admin only and never block notifications or cycle completion.
- Preserve existing dirty/untracked work. Do not deploy, alter secrets, Entra registration, CI/CD, production configuration, or `main` without an explicit later approval.

## Prerequisite release boundary

The repository is currently on `feature/entra-id-auth` with substantial pre-existing dirty Entra/UI/CI work. Do **not** layer the feature implementation into that unreviewed worktree.

Before Task 1:

1. Create a clean, reviewed branch/worktree after the current Entra change is independently reviewed, committed and merged or otherwise isolated.
2. Confirm Entra mapping and backend authorization for only the three target roles.
3. Confirm the fate and removal path of local seeded credentials, local signup flows and the legacy viewer role.
4. Confirm GitHub Actions branch protection/environment approval settings outside the repository; this was not verifiable from the current WSL `gh` setup.

---

## Task 1: Establish migration and deploy safety before schema work

**Objective:** Replace startup-time schema mutation as the delivery mechanism for new issue-control tables.

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/<revision>_baseline_existing_schema.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/app/db/init_db.py`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/DEPLOYMENT_SAFETY.md`
- Modify: `docs/entra-id-integration-plan.md`

**Steps:**
1. Record the current production schema/revision baseline safely; do not generate a destructive baseline.
2. Add Alembic with one verified head.
3. Move future issue schema updates into migration files; do not extend `_apply_schema_updates()` for new issue functionality.
4. Update the deploy workflow design so migrations run before service restart.
5. Add post-deploy checks that fail on unhealthy service, incorrect migration revision, or failed authenticated smoke behaviour.
6. Document the required three-proof deploy evidence: service uptime, `alembic current`, user-visible behaviour.

**Verification:**
```bash
cd backend
alembic heads
alembic current
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

**Acceptance:** exactly one Alembic head; upgrade/downgrade cycle succeeds in a non-production database; no production deploy is performed in this task.

---

## Task 2: Define the issue persistence model and migration

**Objective:** Persist cycle-scoped issues, controlled classifications, completion outcomes and append-only issue activity.

**Files:**
- Create: `backend/app/models/billing_issue.py`
- Create: `backend/app/models/billing_issue_activity.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/<revision>_add_billing_issue_controls.py`
- Create: `backend/app/schemas/issues.py`
- Test: `backend/tests/test_billing_issues_model.py`

**Proposed fields:**

`billing_issues`
- `id` UUID primary key
- `billing_cycle_id` required FK
- `context` required: `execution_issue`, `finance_test_review`, `post_live_observation`
- `related_script_run_id` optional FK
- `classification_id` required FK to configurable reference data
- `title` required
- `detail` required
- `status` required: `open`, `completed`
- `completion_outcome` nullable: `resolved`, `raised_in_error`
- `completed_by`, `completed_at`, `completion_comment`
- `created_by`, `created_at`, `updated_at`

`billing_issue_activities`
- `id`, `billing_issue_id`, `activity_type`, `comment`, `before_state`, `after_state`, `actor_id`, `created_at`

`billing_issue_classifications`
- `id`, `context`, `name`, `sort_order`, `is_active`, timestamps

**Steps:**
1. Write failing model/schema tests for required fields and valid state combinations.
2. Add models and migration.
3. Seed active Finance classifications: Loyalty Points; Bill with Zero or Negative Value; Incorrect Product Setup; Other.
4. Ensure `Other` requires detail at the API validation layer.
5. Add a safe historical-data policy: no issue record deletion; classifications deactivate rather than delete.

**Verification:**
```bash
cd backend
pytest tests/test_billing_issues_model.py -v
alembic upgrade head
alembic current
```

**Acceptance:** a migration creates/reverses the schema safely, classifications seed idempotently, and completion cannot exist without outcome/actor/time; a comment is mandatory only when the outcome is `raised_in_error`.

---

## Task 3: Implement authorization and issue API lifecycle

**Objective:** Enforce the agreed role permissions in the backend and retain audit/activity evidence.

**Files:**
- Create: `backend/app/api/routes/issues.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/services/audit_service.py` only if a reusable event helper is needed
- Modify: `backend/app/services/auth_service.py`
- Test: `backend/tests/test_billing_issue_routes.py`
- Test: `backend/tests/test_billing_issue_permissions.py`

**Endpoints/behaviours:**
- List issues by cycle/context; Billing may read Finance issues.
- Billing/Admin create execution issues only when a related run is supplied.
- Finance/Admin create Finance test-review issues and post-live observations.
- Finance/Admin append activity/comments to Finance issues.
- Finance/Admin complete a Finance issue with `resolved` or `raised_in_error`; a comment is mandatory for `raised_in_error` and optional for `resolved`.
- Finance/Admin reopen a completed `finance_test_review` issue with a mandatory comment only before Move to Live approval exists. Do not support reopening post-live observations in the MVP.
- Prevent deletion.
- Record audit events for create/edit/comment/complete/raised-in-error/reopen.

**Permission matrix:**

| Action | Billing | Finance | Admin |
| --- | --- | --- | --- |
| Read all cycle issues | Yes | Yes | Yes |
| Create execution issue | Yes | No | Yes |
| Create Finance test-review issue | No | Yes | Yes |
| Create post-live observation | No | Yes | Yes |
| Comment/edit/complete/reopen Finance issue | No | Yes | Yes |
| Approve Move to Live | No | Yes | Yes |

**Verification:**
```bash
cd backend
pytest tests/test_billing_issue_routes.py tests/test_billing_issue_permissions.py -v
```

**Acceptance:** API returns `401` for invalid identity, `403` for valid disallowed roles, and preserves Finance-only control ownership.

---

## Task 4: Enforce the Test Approval gate in the backend

**Objective:** Make open Finance test-review issues a server-authoritative block on Move to Live approval.

**Files:**
- Modify: `backend/app/api/routes/approvals.py`
- Create: `backend/app/services/issue_control_service.py`
- Test: `backend/tests/test_approval_issue_gate.py`

**Steps:**
1. Query open `finance_test_review` issues for the approval cycle.
2. Reject an approval request/decision that would approve Move to Live while an issue remains open.
3. Return a structured error including the number of open issues; do not expose unnecessary issue detail in an authorization error.
4. Allow approval once all Finance issues are completed, including issues marked `raised_in_error`.
5. Keep rejection possible with Finance comments regardless of issue count.

**Verification:**
```bash
cd backend
pytest tests/test_approval_issue_gate.py -v
```

**Acceptance:** frontend-only hiding cannot bypass the gate through a direct API request.

---

## Task 5: Build Finance review and Billing visibility UI

**Objective:** Put the primary control in the existing Test Approval stage, using the existing design system.

**Files:**
- Create: `frontend/src/features/issues/FinanceIssuePanel.jsx`
- Create: `frontend/src/features/issues/IssueFormDialog.jsx`
- Create: `frontend/src/features/issues/IssueActivityDialog.jsx`
- Create: `frontend/src/features/issues/issue-api.js`
- Modify: `frontend/src/features/cycles/ApprovalStage.jsx`
- Modify: `frontend/src/context/AppDataContext.jsx` or replace scoped data access as appropriate
- Modify: `frontend/src/components/billing/StatusBadge.jsx`
- Test: `frontend/src/features/issues/*.test.jsx` if the repository test harness is introduced

**Required states:**
- empty: no Finance review issues; approval can proceed when runs are ready;
- open: list open issues and show approval lock reason;
- completed/resolved: visibly show Finance completion date/comment;
- completed/raised-in-error: visually label and explain exclusion from KPI reporting;
- reopened: show updated status/activity;
- loading/error/permission-denied;
- Billing read-only view without Finance edit/complete controls.

**UX rules:**
- use semantic tokens and existing shadcn-style primitives;
- accessible labels and keyboard-operable dialogs;
- no status conveyed by colour alone;
- one clear primary action at a time; and
- do not use a generic dashboard or ticket queue.

**Verification:**
```bash
cd frontend
npm run lint
npm run build
```

Then inspect Test Approval as Billing, Finance and Admin in a browser at desktop and mobile widths; check console errors and approval lock behaviour.

---

## Task 6: Add Billing run-level execution issue capture

**Objective:** Allow Billing to retain rare operational context against an individual execution without creating a second readiness mechanism.

**Files:**
- Create: `frontend/src/features/issues/ExecutionIssueDialog.jsx`
- Modify: `frontend/src/features/cycles/ScriptsRunsStage.jsx`
- Modify: `backend/app/api/routes/issues.py`
- Test: `backend/tests/test_execution_issue_routes.py`

**Steps:**
1. Add a per-run action to log an execution issue.
2. Require association to the selected script run.
3. Show a compact issue indicator on that run.
4. Keep run status (`planned/executed/failed`) as the only execution-readiness determinant.

**Acceptance:** a logged execution issue does not independently stop a run marked executed; failed/incomplete run readiness behaves as it did before.

---

## Task 7: Add Finance post-live observations

**Objective:** Retain Finance-only learning after Live without interfering with completion.

**Files:**
- Create: `frontend/src/features/issues/PostLiveObservationPanel.jsx`
- Modify: `frontend/src/features/cycles/NotificationsStage.jsx` or the designated post-live surface
- Modify: `backend/app/api/routes/issues.py`
- Test: `backend/tests/test_post_live_observation_permissions.py`

**Steps:**
1. Add Finance/Admin-only create/read controls.
2. Reuse the Finance classification list and activity/audit rules.
3. Clearly state in UI that observations do not block notifications or cycle completion.

**Acceptance:** Billing cannot create post-live observations and open post-live observations do not block the workflow.

---

## Task 8: Implement cycle-quality reporting

**Objective:** Give Finance/Admin decision-ready evidence for the Revenue Protection and Growth objective without inventing financial values.

**Files:**
- Create: `backend/app/api/routes/issue_reporting.py`
- Create: `frontend/src/features/reporting/BillingIssueReportingPage.jsx`
- Modify: `frontend/src/components/layout/nav.js`
- Test: `backend/tests/test_issue_reporting.py`

**Metrics:**
- Finance test-review issues per cycle/month;
- approved classifications, excluding `raised_in_error` from headline totals;
- Test-review vs post-live observations;
- time from issue creation to Finance completion;
- number of cycles whose Move to Live approval was blocked by an open issue;
- raised-in-error records as a separate audit-quality measure.

**Acceptance:** every metric has an explicit source field, filter scope, empty state and user decision it supports. Do not calculate revenue-at-risk or values in MVP.

---

## Task 9: Complete Entra enforcement and safe rollout

**Objective:** Make Entra authentication/authorization authoritative only after behaviour is validated in controlled production increments.

**Files:**
- Modify: `docs/entra-id-integration-plan.md`
- Modify: `06_ENTRA_ID_INTEGRATION_GUIDE.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `EXIT.md` if/when created/used for production handover

**Rollout:**
1. Passive deploy with Entra feature flag disabled; prove legacy behaviour unchanged.
2. Pilot with a small assigned group; verify correct role identity, API authorization and no `viewer` dependency.
3. Run a controlled non-destructive Test-cycle workflow including Finance issue creation/completion and approval gate.
4. Verify deploy proof: service uptime, `alembic current`, user-visible role behaviour.
5. Only then schedule local login/signup retirement and Entra enforcement.

**Acceptance:** no local auth path remains as an undocumented Entra bypass after cutover; rollback is documented and feature-flagged where required.

---

## Pre-merge and deploy quality gate

Before any production-intended change is merged:

```bash
cd backend && pytest -q
cd backend && alembic heads && alembic current
cd frontend && npm run lint && npm run build
```

Required manual checks:

1. Billing can log/read permitted execution issues but cannot alter Finance issues.
2. Finance can create multiple test-review issues for one cycle.
3. Move to Live is blocked by any open Finance issue at the API and UI layers.
4. Finance can mark an issue `resolved` or `raised_in_error`; a comment is mandatory for the raised-in-error outcome.
5. Raised-in-error records are visible in audit but excluded from headline reporting.
6. Before Move to Live approval, Finance can reopen a completed test-review issue and approval becomes blocked again; after approval, reopening is rejected and later findings are post-live observations.
7. Post-live observations are Finance/Admin-only and do not block completion.
8. Entra role checks pass for Billing, Finance and Admin; no viewer path remains.
9. Deploy proof records service uptime, migration revision and user-visible behaviour.

## Risks and decisions carried forward

- Existing uncommitted Entra/UI/CI work must be reviewed/isolated first.
- Introducing migration tooling against the existing production database needs a reviewed baseline and rollback exercise.
- Current GitHub branch protection/environment status remains unverified because the WSL `gh` launcher failed; verify it directly in GitHub before deploy automation changes.
- No financial amount field is in scope; obtain Finance approval before adding one.
- No attachment storage is in scope; comments/external references are sufficient for MVP.
