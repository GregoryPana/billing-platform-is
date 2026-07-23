# Implementation Readiness Pack — Revenue Protection Issue Control

**Project:** Billing Collaboration Platform
**Implementation source of truth:** `docs/plans/2026-07-21-revenue-protection-issue-control.md`
**Business/design source of truth:** `docs/FINANCE_ISSUE_CONTROL_DESIGN.md`
**Wireframe:** `docs/wireframes/finance-test-review-approval.html`

## 1. Approved business contract

### Monthly workflow

```text
Billing completes Test Preparation + Test Printing executions
→ Finance performs off-platform bill validation
→ Finance logs zero or more Finance test-review issues for that monthly cycle
→ Billing reads the findings and acts outside the platform
→ Finance completes/resolves or marks an invalid finding Raised in Error
→ only then can Finance approve Move to Live
→ Billing completes Live execution
→ Finance/Admin can record post-live observations without blocking completion
```

### Roles

| Capability | Billing | Finance | System Admin |
| --- | --- | --- | --- |
| Run scripts / record run status | Yes | No | Yes |
| Create execution issue linked to a run | Yes | No | Yes |
| Read Finance cycle-review issues | Yes | Yes | Yes |
| Create/edit/comment/complete/reopen Finance test-review issue | No | Yes | Yes |
| Approve/reject Move to Live | No | Yes | Yes |
| Create post-live observation | No | Yes | Yes |
| Administration/audit | No | No | Yes |

Target Entra roles are exactly `billing_user`, `finance_user`, `system_admin`. The legacy `viewer` role is not part of the target model.

### Finance test-review issue rules

- Finance may log multiple findings for one monthly billing cycle.
- Required initial classifications: Loyalty Points; Bill with Zero or Negative Value; Incorrect Product Setup; Other.
- An `Other` finding requires detail.
- Status: `open` or `completed`.
- Completion outcome: `resolved` or `raised_in_error`.
- A `raised_in_error` completion requires an explanation and remains in audit/history but is excluded from headline KPI totals.
- A `resolved` completion comment is optional.
- Finance can reopen only a completed **test-review** issue, only before Move to Live approval, and only with a comment.
- After approval, a new finding is a post-live observation; do not reopen an earlier test-review issue.
- Post-live observations are Finance/Admin-only and never block workflow completion.
- No assignment, due date, SLA, file attachment, monetary estimate, or cross-cycle backlog in MVP.

## 2. Preconditions — do not start feature implementation until these pass

### Gate A — existing Entra change boundary

The current `feature/entra-id-auth` worktree contains substantial uncommitted changes across auth, CI/CD, frontend and documentation.

Before the issue-control feature begins:

1. Review the current Entra change independently.
2. Separate/commit it as a bounded change, or create a clean worktree/branch from a verified base commit.
3. Verify backend role enforcement for `billing_user`, `finance_user`, `system_admin`.
4. Decide and implement removal/retirement path for `viewer` and legacy local user/signup paths.
5. Do not mix the new issue-control changes into the existing dirty files without a reviewed boundary.

**Gate result required:** clean feature branch or worktree with named base commit and an explicit statement of what Entra/local-auth behaviour is active.

### Gate B — migration and deploy safety

The repo currently has no Alembic migration framework and startup schema mutation exists in `backend/app/db/init_db.py`.

Before adding issue tables:

1. Establish a reviewed Alembic baseline with exactly one head.
2. Exercise upgrade → downgrade → upgrade against a disposable local database.
3. Update the deployment sequence: migration before service restart.
4. Add post-deploy proof: service uptime, `alembic current`, user-visible behaviour.
5. Confirm GitHub branch protection and environment approval outside the repo.

**Gate result required:** a tested, reversible migration path. No production database/schema command is run until separately approved.

### Gate C — test harness baseline

The repository currently exposes no tracked automated tests. Before business-rule code:

1. Add a backend pytest harness and minimal fixtures for a disposable database.
2. Establish frontend test tooling only where it can execute reliably; do not pretend it exists otherwise.
3. Record exact commands and expected output in CI.

**Gate result required:** a failing regression test can be written and run locally before a behaviour change is implemented.

## 3. Delivery phases

| Phase | Outcome | Do not proceed until |
| --- | --- | --- |
| 0 | Entra work reviewed/isolated; clean base established | Gate A passes |
| 1 | Alembic, tests and safe deployment checks | Gates B/C pass |
| 2 | Issue model, classification reference data, activity and permissions | Model/API tests pass |
| 3 | Server-side Move-to-Live issue gate | Direct API bypass test fails correctly with open issue |
| 4 | Finance review UI + Billing read-only visibility | Browser/design-quality checks pass |
| 5 | Billing execution issues + Finance post-live observations | Role/flow tests pass |
| 6 | Cycle-quality reporting | Raised-in-error exclusion is tested |
| 7 | Entra pilot/cutover and production release | Three-proof deployment evidence completed |

## 4. Required implementation artefacts

The implementing agent must create/update these as applicable:

- Alembic configuration and revisions under `backend/alembic/`.
- Backend tests under `backend/tests/`.
- Issue models, schemas, router and service as specified by the plan.
- Frontend issue feature components and API access layer.
- `docs/DEPLOYMENT_SAFETY.md`.
- `docs/VERIFICATION_MATRIX.md`.
- `docs/platform/finance_user_guide.md` and `docs/platform/billing_user_guide.md` after UI behaviour is implemented; remove stale viewer/local-login guidance when Entra cutover is approved.
- `.opencode/hermes-pending-updates.md` after each meaningful slice.

## 5. Required tests and checks

### Backend behaviour

- Billing cannot create/alter Finance test-review issues.
- Finance can create multiple test-review issues for one cycle.
- Open Finance test-review issue blocks approval through the backend API.
- `raised_in_error` requires an explanatory comment.
- `resolved` does not require a comment.
- Reopen requires Finance/Admin, a comment, and absence of Move-to-Live approval.
- Post-live observations never block the workflow.
- `viewer` cannot authenticate/authorize after the target Entra cutover.

### Frontend behaviour

- Finance sees a clear issue summary and blocked approval explanation.
- Billing sees Finance findings read-only.
- Finance-only controls are absent for Billing.
- Empty, loading, API error, completed, raised-in-error and reopened states work.
- Mobile/tablet/desktop views preserve priority and no horizontal page overflow occurs.

### Delivery proof

```bash
cd backend && pytest -q
cd backend && alembic heads && alembic current
cd frontend && npm run lint && npm run build
```

Production verification, only after explicit approval:

1. service uptime/restart proof;
2. migration revision proof with `alembic current`;
3. authenticated user-visible test by role.

## 6. Hard stop / escalation conditions

The agent must stop and report rather than improvise if:

- the Entra role claim mapping does not support the three target roles;
- it cannot establish a safe Alembic baseline without production schema knowledge;
- migration testing requires a live production database;
- a change would alter secrets, Entra registration, GitHub secrets, Nginx, systemd, deployment runner or production database;
- the pre-existing dirty worktree makes it impossible to identify the intended diff;
- the existing Finance approval behaviour differs materially from the documented flow.

## 7. Agent operating protocol

1. Read `AGENTS.md`, `CLAUDE.md`/`OPENCODE.md`, project-local skills and the three issue-control artifacts first.
2. Use CodeGraph first for orientation and impact analysis.
3. Work in one bounded phase only; do not attempt the full plan in one session.
4. Use TDD for behaviour. Write failing test, run it, implement minimum change, rerun test.
5. After every phase: run spec-compliance review first, then code-quality review.
6. Do not commit/stage unrelated pre-existing work.
7. Do not deploy. Report exact changed files, commands, results, verification gaps and next gate.

## 8. Go/no-go status

**Planning:** READY.
**Feature implementation:** NOT READY until Gates A, B and C pass.
**Production deployment:** NOT READY until GitHub/runner/Entra configuration and three-proof deployment checks are separately verified.
