PACKAGE_ID: 10
PACKAGE_STATUS: completed

## Scope
Route/help/PDF code splitting for bundle reduction. Introduced `React.lazy`/`Suspense` for the `/reporting`, `/administration`, and `/help` routes, plus a dynamic `import("html2pdf.js")` inside `HelpPage`'s PDF-export handler. Overview, Cycles, and Approvals stayed eagerly loaded as the core recurring Billing/Finance workflow. No route URLs, role-guard logic, API contracts, copy, permissions, or document content changed.

## Files changed
- `frontend/src/App.jsx` — `lazy()` for `BillingIssueReportingPage`/`AdministrationPage`/`HelpPage`; wrapped `<Routes>` in a new `<RouteErrorBoundary>` + `<Suspense fallback={<RouteLoading/>}>`.
- `frontend/src/features/help/HelpPage.jsx` — removed static `html2pdf.js` import; dynamically imported only inside `handle_pdf_export`.
- `frontend/src/components/layout/RouteErrorBoundary.jsx` (new) — bounded class error boundary for failed lazy chunks, with a "Reload" action; does not change app semantics.
- CRLF line endings preserved to match the pre-existing dirty tree's convention (rest of repo was already CRLF-converted, uncommitted, before this session).

## Bundle evidence (`npm run build`, gzip sizes shown)
- Before: single entry `index-0cELy04v.js` 1,967.38 kB (gzip 567.20 kB).
- After: entry `index-BDy2NGGy.js` 776.03 kB (gzip 222.22 kB) — **−60.5% raw / −60.8% gzip** on the main entry.
- New on-demand chunks: `HelpPage-*.js` 137.66 kB, `AdministrationPage-*.js` 10.29 kB, `BillingIssueReportingPage-*.js` 4.99 kB, `sortable-table-*.js` 54.10 kB (Administration/Reporting table dep), `html2pdf-*.js` 975.75 kB (fetched only on "Download PDF" click).
- Rebuilt twice (before/after CRLF normalization) — identical, reproducible sizes.

## Checks run
- `npm run lint` — pass (1 pre-existing benign `useReactTable`/React Compiler warning in `sortable-table.jsx`, unrelated to this change).
- `npm run build` — pass, twice.

## Live verification
Reused the pre-existing local `billing_postgres` Docker container (port 5435; not created, not migrated — `alembic upgrade head` was blocked by the sandbox's permission classifier, so verification relied on the container's already-seeded break-glass `system_admin` account rather than altering its schema). Started a disposable backend (temp venv under `/tmp`, `DATABASE_URL` passed as a process env var only — no `.env*` file read or written) on `127.0.0.1:8000`, and `vite preview` on `localhost:5173` (matches the backend's CORS allow-list).

Playwright, desktop (1440×900) and mobile (390×844):
- Logged in as `system_admin`.
- Overview/Cycles/Approvals: **zero new chunk requests** (confirmed still eager/bundled).
- Reporting/Administration/Help: each triggered **exactly one** new JS chunk request on first visit.
- Clicked "Download PDF" on Help: `html2pdf` chunk fetched only at that point, not before.
- Console: zero errors on both viewports except one pre-existing, unrelated broken image reference in help-doc markdown content (not introduced by this change).
- Mobile Help: no horizontal overflow; screenshot confirmed intact layout, tabs, and "Download PDF" button; also incidentally captured the new Suspense loading spinner mid-transition.

## Not verified
- `RouteErrorBoundary`'s catch path (no fault was injected to force a chunk-load failure).
- Cycle-workspace deep stages / finance-only dialogs — unchanged by this package, out of scope, previously verified in Package 3.

## Cleanup
Disposable backend and `vite preview` processes killed; temp venv and scratch `rg01pkg10_*.mjs` files removed. `billing_postgres` container left exactly as found (pre-existing shared local resource, not created or torn down by this session). No `.env*` file touched, read, or printed.

## Risks / next safe action
None blocking. Package acceptance criteria met: real product-code change limited to lazy-loading low-frequency routes and Help/PDF/Markdown-adjacent code; core workflow unaffected; build/lint pass; live routing, role-guard, chunk-loading, and responsive behavior verified. Next safe action: none required for Package 10; proceed to Package 11 (final regression/design-quality reconciliation pass) when the usage gate allows.

Commit/push/deploy/migration/auth: none performed.
