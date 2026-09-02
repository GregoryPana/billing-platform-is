# RG-01 Package 3 — Verification Matrix

Session: 2026-09-01 (Package 3 re-run, third attempt). Disposable stack: Postgres 16-alpine in a
throwaway Docker container (`rg01_pkg3_pg`, port 55432, `--rm`, non-persistent), backend on
`127.0.0.1:58010` against that database, frontend Vite dev server on `localhost:5173` (the app's
CORS allow-list in `backend/app/main.py` is hardcoded to `http://localhost:5173`, so this port was
required for the browser to reach the API at all — noted as a pre-existing finding from Package 1,
not something changed this session). Local-auth test users seeded directly for the three roles
(`billing_user`, `finance_user`, `system_admin`, password `Verify2026!`), separate from the
break-glass `admin` account. Driven headlessly with Playwright (Chromium). Everything was stopped
and removed before this session ended; no application code was changed.

## Rebaseline confirmation (Packages 0–2)

| Package | Landed on branch? | Evidence |
|---|---|---|
| 0 — doc rebaseline | Yes | `docs/DESIGN_SYSTEM_ADDENDUM.md` present; README/blueprint headers updated |
| 1 — runtime-origin/CORS | Yes (no code change was its intended outcome) | `backend/app/main.py:12` still hardcodes `allow_origins=["http://localhost:5173"]`; same-origin Nginx layout confirmed in `docs/github-deployment-guide.md` |
| 2 — sign-in polish | Yes | `frontend/src/features/auth/LoginPage.jsx` has the boundary subtitle, "Sign in" headline, `Eye`/`EyeOff` toggle with `aria-pressed`, and no `opacity-70` on the footer |

## Automated checks

| Check | Result |
|---|---|
| `cd backend && pytest -q` | **107 passed**, 0 failed (run against the disposable DB via `TEST_DATABASE_URL`) |
| `cd backend && alembic heads` | `f3a9c1d7e2b4 (head)` — single head |
| `cd backend && alembic current` | `f3a9c1d7e2b4 (head)` — matches, migrations applied clean |
| `cd frontend && npm run lint` | pass, 0 errors/warnings |
| `cd frontend && npm run build` | pass in ~1m; pre-existing `>500kB` main-chunk warning only (unrelated, tracked separately as Package 10) |

## Sign-in screen re-verification (Package 2 polish)

| Item | Result | Detail |
|---|---|---|
| Boundary subtitle copy | pass | "Coordinates the monthly billing cycle and prepares commands and approvals — billing execution stays in Cerillion." matches the documented platform boundary |
| Headline copy | pass | "Billing Platform" / "Sign in" block renders as expected |
| Password-toggle visibility | pass | Show/Hide toggle visible, `aria-pressed` flips `false → true`, input `type` flips `password → text` |
| Footer/secondary-text contrast | pass | Independently re-measured this session: `rgb(75, 87, 104)` on `rgb(255, 255, 255)`, opacity `1` (no `opacity-70`) → **7.34:1**, matches Package 2's recorded 7.35:1 (rounding only) — passes WCAG AA for normal text (≥4.5:1) |

## Role × route × check-type matrix

Routes per role per `frontend/src/components/layout/nav.js`: `billing_user` → Overview, Cycles,
Administration, Help; `finance_user` → Overview, Approvals, Reporting, Help; `system_admin` → all
of the above.

| Role | Route | Console | Network | Responsive 375/768/1024/1440 | Keyboard |
|---|---|---|---|---|---|
| billing_user | Overview | pass | pass | pass / pass / pass / pass | not-tested — see note |
| billing_user | Cycles (list) | pass | pass | not-tested (only Overview/Approvals/Reporting/Administration were the responsive targets per the instructed page list) | not-tested |
| billing_user | Cycles → cycle workspace (`/cycles/:id`) | pass | pass | not-tested | not-tested |
| billing_user | Administration | pass | pass | pass / pass / pass / pass | not-tested |
| billing_user | Help | pass | pass | not-tested (Help not in the instructed responsive page list) | not-tested |
| finance_user | Overview | pass | pass | pass / pass / pass / pass | not-tested |
| finance_user | Approvals Inbox | pass | pass | pass / pass / pass / pass | not-tested |
| finance_user | Issue Reporting | pass | pass | pass / pass / pass / pass | not-tested |
| finance_user | Help | pass | pass | not-tested (not in instructed list) | not-tested |
| system_admin | Overview | pass | pass | pass / pass / pass / pass | not-tested |
| system_admin | Cycles (list) | pass | pass | not-tested (not in instructed list) | not-tested |
| system_admin | Cycles → cycle workspace (`/cycles/:id`) | pass | pass | not-tested | not-tested |
| system_admin | Approvals Inbox | pass | pass | pass / pass / pass / pass | not-tested |
| system_admin | Issue Reporting | pass | pass | pass / pass / pass / pass | not-tested |
| system_admin | Administration | pass | pass | pass / pass / pass / pass | not-tested |
| system_admin | Help | pass | pass | not-tested (not in instructed list) | not-tested |

Per-role keyboard cells above are marked not-tested individually because the instructed keyboard
scope was "at least one dialog... and the sidebar navigation" (satisfied once, below), not a
per-route requirement — no defect is implied.

## Dedicated keyboard / focus checks

| Target | Check | Result | Note |
|---|---|---|---|
| Sidebar navigation | Tab reaches first nav link | pass | First `Tab` from Overview lands on the "Overview" sidebar link |
| Sidebar navigation | Visible focus outline | pass | `outline` or `box-shadow` present on the focused element |
| Login form | Tab order | pass | Email/username → Show/Hide toggle → Password → Sign In, no trap |
| "Log Execution Issue" dialog (Cycle Workspace, Test Scripts & Runs stage) | Opens via click | pass | Reached by creating a cycle, generating a test script, marking one run "executed", then opening the dialog |
| Same dialog | Focus stays inside dialog after Tab | pass | `document.activeElement` remains inside `[role="dialog"]` |
| Same dialog | Escape closes it | pass | Dialog unmounts on `Escape` |

## Cycle workspace stage coverage

Only the initial **Test Scripts & Runs** stage was exercised (script generation, marking a run
"executed", opening the execution-issue dialog). The later stages — Test Approval, Live Scripts &
Runs, Post-Live Approval, Notifications, Closed — were **not tested**: reaching them requires
progressing a cycle through finance approval and live-run gates, which is multi-step functional
workflow testing beyond this session's console/network/responsive/keyboard verification scope and
risked broadening into the separately-scoped maintainability backlog (Packages 5–10). This is a
coverage gap, not a defect.

## What was not tested, and why

- **Cycle workspace stages beyond "Test Scripts & Runs"** (Test Approval, Live Scripts & Runs,
  Post-Live Approval, Notifications, Closed) — not reached; see above.
- **Entra ID sign-in path** — out of scope; this session used local auth only, per the RG-01
  readiness boundary and the "no auth rollout" instruction.
- **Responsive checks on Cycles-list and Help pages** — the task's instructed responsive page list
  was login, Overview, Cycle Workspace, Approvals Inbox, Issue Reporting, Administration; Cycles-list
  and Help were exercised for console/network only, not the four breakpoints.
- **Per-route keyboard nav** beyond the sidebar and one dialog — instructed scope was "at least
  one dialog... and the sidebar navigation," which is satisfied above.
- **Finance Review Issue dialog** (`IssueFormDialog` via `FinanceIssuePanel`) — not reached; it
  only renders once a cycle is in the Test Approval stage, which was not reached this session.

## Defects found

None. Every check that was run — 107 backend tests, both Alembic checks, both frontend checks, and
every role/route/responsive/keyboard check attempted — passed. No application code was changed
this session.

## Package 11 independent final-gate addendum — 2026-09-02

- Fresh disposable PostgreSQL 16 test run: **107 passed**, 0 failed; 3 dependency/deprecation warnings.
- Frontend lint: 0 errors; one known TanStack/React Compiler compatibility warning.
- Frontend production build: pass; main entry 776.03 kB raw / 222.22 kB gzip after Package 10 splitting.
- Package 9 Audit sorting/pagination browser evidence: pass. Populated Issue Reporting sort/pagination remains a bounded coverage exception; its empty state and shared table primitive were verified.
- Package 10 eager/lazy route and PDF chunk behavior: pass on desktop/mobile; forced lazy-chunk failure path not fault-injected.
- Restored `backend/.env.local` remained unchanged after recovery verification; Package 9 scratch scripts were removed.
- Technical decision: Packages 0–3 and 5–10 accepted. Package 4 Finance/Billing pilot, vocabulary confirmation, routine-use evidence, Entra/deployment decisions and business acceptance remain external gates.
- Full handover: `docs/rg01-handoffs/package-11-latest.md`.
