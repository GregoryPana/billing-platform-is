PACKAGE_ID: 6
PACKAGE_STATUS: completed

## Scope
Bridge-class → shared-component migration (maintainability backlog, not required for RG-01). Zero intended visual change: moved `.panel`/`.data-row`/`.data-table`/`.empty-state` (and their sub-selectors `.panel-header`, `.panel-subheader`, `.panel-details`, `.table-head`) from `App.css` `@apply` rules into composed `components/ui/*` primitives.

## Rebaseline
`grep -rn 'className="[^"]*\b(panel|data-row|data-table|empty-state)\b"' frontend/src/features` at session start returned 13 files (this list differs from any prior review, as expected on a fast-moving branch): `admin/AdministrationPage.jsx`, `approvals/ApprovalsInboxPage.jsx`, `cycles/ApprovalStage.jsx`, `cycles/CyclesListPage.jsx`, `cycles/CycleWorkspacePage.jsx`, `cycles/NotificationsStage.jsx`, `cycles/ScriptsRunsStage.jsx`, `help/HelpPage.jsx`, `issues/FinanceIssuePanel.jsx`, `issues/IssueActivityDialog.jsx`, `issues/PostLiveObservationPanel.jsx`, `overview/OverviewPage.jsx`, `reporting/BillingIssueReportingPage.jsx`.

## New primitives (each pattern repeated far more than 3 times, so shared components were justified)
- `frontend/src/components/ui/panel.jsx`: `Panel`, `PanelHeader`, `PanelTitle`, `PanelDescription`, `PanelSubheader`, `PanelSubheaderTitle`, `PanelSubheaderDescription`, `PanelDetails`, `PanelDetailsSummary`.
- `frontend/src/components/ui/data-table.jsx`: `DataTable`, `DataTableRow` (`variant`: `default`/`runs`/`admin`; `head`; `as` for the two clickable-row files that used native `<button>`).
- `frontend/src/components/ui/empty-state.jsx`: `EmptyState`.

All three carry the exact Tailwind strings copied from the removed `App.css` rules, including the `max-[900px]:...` arbitrary variants that reproduce the old media-query overrides per row variant.

## Classes fully removed from `App.css`
`.panel`, `.panel-header` (+ `h2`/`p`), `.panel-subheader` (+ `h3`/`p`), `.panel-details` (+ `summary`), `.data-table`, `.data-row` (+ hover, `.runs`, `.admin`), `.table-head`, `.empty-state`, and the three related rules inside `@media (max-width: 900px)`. Removed only after a repo-wide grep confirmed zero remaining consumers. `:root`/`.dark` token blocks untouched; no colors/spacing/copy changed.

## Classes still present, out of scope
`.doc-panel` and `.dialog-panel` — distinct classes, not among the four targeted (word-boundary regex matches them as substrings but they're separately scoped). `.doc-panel .panel-header` was retargeted to `.doc-panel [data-slot="panel-header"]` (a `data-slot` attribute added to `PanelHeader`) since the literal `panel-header` class no longer exists — same base/900px selectors, same declarations, just a different hook.

## Verification
- `npm run lint`: one real failure (`Tag` unused-var from a destructured-and-renamed `as: Tag` param not recognized by ESLint's JSX tracking) — fixed by deriving `Tag` as a `const` inside the function body; lint then passed clean.
- `npm run build`: passed (~1m28s; pre-existing >500kB chunk warning, unrelated).
- Disposable stack: throwaway `postgres:16-alpine` (port 55492, `--rm`, not the persistent `billing_postgres:5435`), backend venv on `127.0.0.1:58061` (`alembic upgrade head` applied cleanly), frontend Vite on `localhost:5173` (required exact origin — `main.py` hardcodes CORS to it). Seeded `system_admin`/`billing_user`/`finance_user` accounts + one cycle via API. Playwright (headless) logged in as all three roles, screenshotted Billing Cycles, Overview, Approvals Inbox, Administration (Settings + Users tabs), and Help at 1440/900/375px. Zero console errors, zero failed requests across every page/role.
- Visually confirmed identical to the design system: Panel/PanelHeader typography and spacing, DataTable/DataTableRow header/body/hover/variant column widths, EmptyState centered muted copy, the 900px breakpoint collapse (padding, grid columns, gap, font-size), and the `doc-panel` header override on Help.
- One pre-existing, unrelated layout quirk observed (not caused by this session, not fixed — fixing it would be a behavior change, out of this package's class-migration scope): the admin Users table's Action column (Edit/Delete buttons) wraps to its own row on desktop because `.form-actions { grid-column: 1 / -1; }` (untouched, unrelated class) can't fit into the grid's first row. Confirmed identical before/after via unchanged DOM order and unchanged CSS rule.

## Cleanup
Backend/frontend dev processes killed, `rg01pkg6_pg` container stopped (auto-removed), temp venv/scripts/env files/screenshots deleted. Confirmed via `docker ps -a`/`ss -ltnp`/`ps aux` that nothing from this session was left running.

## Files changed this session
New: `frontend/src/components/ui/panel.jsx`, `data-table.jsx`, `empty-state.jsx`.
Modified: `frontend/src/App.css`; `frontend/src/features/{admin/AdministrationPage,approvals/ApprovalsInboxPage,cycles/ApprovalStage,cycles/CycleWorkspacePage,cycles/CyclesListPage,cycles/NotificationsStage,cycles/ScriptsRunsStage,help/HelpPage,issues/FinanceIssuePanel,issues/IssueActivityDialog,issues/PostLiveObservationPanel,overview/OverviewPage,reporting/BillingIssueReportingPage}.jsx`; `docs/RG01_ALIGNMENT_TRACKER.md`; this handover.
Pre-existing dirty files in the same directories, untouched by this session: `issues/ExecutionIssueDialog.jsx`, `issues/IssueFormDialog.jsx`, `issues/issue-api.js`, `issues/issue-status.js`, `reporting/reporting-api.js`.

## Next safe action
None for Package 6. Package 7 (verified domain information tips) is next in the register, contingent on the usage gate. No commit/push/deploy/migration/auth changes were made.
