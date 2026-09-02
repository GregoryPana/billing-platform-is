PACKAGE_ID: 5
PACKAGE_STATUS: completed

## Scope
Replaced the global poll-everything pattern in `frontend/src/context/AppDataContext.jsx`
(single 30s interval fetching `cycles`, `scripts`, `runs`, `approvals`, `notifications`,
`audit_logs`, and `users` for admins — on every route, all the time) with per-route
scoped fetching. No backend route, API response shape, or role-permission logic changed.

## Mechanism
Added a ref-counted `useDataScope(collections)` hook. Each page/tab that reads data calls
it with a stable, module-level array of the collection keys it needs. `AppDataProvider`
tracks live counts per collection in a ref; a collection is fetched and kept on the 30s
poll only while at least one mounted consumer has it registered. When a route change
brings a not-yet-active collection into scope, it is fetched immediately instead of
waiting for the next tick. Cross-collection derived data (`cycles_by_id`, `pending_approvals`,
`approvals_by_cycle_stage`, etc.) is untouched — still computed from whatever is in state.

## Route → collection mapping used
- `MainLayout` (wraps every route, approval-granted banner): `cycles`, `approvals` — these
  two stay effectively always-on.
- `/overview`: `cycles`, `scripts`, `runs`, `approvals`, `notifications`
- `/cycles`: `cycles`, `scripts`, `runs`, `approvals`
- `/cycles/:id`: `cycles`, `scripts`, `runs`, `approvals`, `notifications`
- `/approvals`, `/approvals/:id`: `cycles`, `approvals`
- `/reporting`: `cycles`
- `/administration`: Settings tab needs nothing extra (operator settings are already a
  separate fetch); Users tab → `users`; Audit Log tab → `audit_logs` (fetched only when
  that tab is actually clicked, not on landing on Administration)
- `/help`: nothing

## Files changed
`frontend/src/context/AppDataContext.jsx`, `frontend/src/components/layout/MainLayout.jsx`,
`frontend/src/features/overview/OverviewPage.jsx`, `frontend/src/features/cycles/CyclesListPage.jsx`,
`frontend/src/features/cycles/CycleWorkspacePage.jsx`, `frontend/src/features/approvals/ApprovalsInboxPage.jsx`,
`frontend/src/features/reporting/BillingIssueReportingPage.jsx`, `frontend/src/features/admin/AdministrationPage.jsx`.
These 8 files were already present in the pre-existing dirty tree from earlier packages;
my delta on top is the `useDataScope` import/call and its scope-array constant in each,
plus the full context rewrite. No other files touched.

## Checks
- `npm run lint` — pass.
- `npm run build` — pass (pre-existing >500kB chunk-size warning only, unrelated to this change).

## Disposable-stack browser verification
Throwaway `postgres:16-alpine` container (`rg01pkg5_pg`, port 55491 — not the persistent
`billing_postgres` on 5435), backend venv in `/tmp/rg01pkg5_venv` on `127.0.0.1:58020`,
frontend Vite dev server on `localhost:5173` (required — `backend/app/main.py` hardcodes
`allow_origins=["http://localhost:5173"]`; confirmed the port was free before use, never
touched a running dev server). Seeded `billing_user`/`finance_user`/`system_admin` accounts
and one sample cycle.

Playwright network-tab capture confirmed:
- Overview and Cycles List both render the same seeded cycle (display parity preserved).
- Navigating overview → help → reporting → overview: `scripts`/`runs`/`notifications`
  drop out of scope on help/reporting and are freshly re-fetched on return to overview.
- `cycles`/`approvals` stay continuously active via `MainLayout`'s scope and are not
  redundantly refetched on every navigation.
- Administration's default (Settings) tab issues no extra fetch; `users` and `audit_logs`
  fetch only when their respective tab is clicked.
- Cycle workspace loads correctly for a `billing_user`, zero console errors, zero failed
  requests across all routes checked.

One test-script bug (a stale Playwright request listener left attached across route
changes) initially produced a misleading combined result; diagnosed via per-request
timestamp logging and fixed before drawing conclusions. No product-code defect found.

## Cleanup
Backend/frontend processes killed, `rg01pkg5_pg` container stopped (auto-removed, `--rm`),
all temp files/scripts/venv deleted. Verified via `docker ps -a`, `ss -ltnp`, `ps aux` that
nothing from the disposable stack remained.

## Next safe action
Package 6 (bridge-class shared-component migration), contingent on the usage gate.
