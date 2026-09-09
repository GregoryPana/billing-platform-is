PACKAGE_ID: 12B
PACKAGE_STATUS: completed

## Synthetic pre-pilot rehearsal and final quality package

This package exercises the complete implemented cycle using only synthetic/disposable data and mocked external integrations. It does not substitute for the real Finance/Billing pilot (Package 4) and does not declare business acceptance.

## Scope

- All three effective roles: billing_user, finance_user, system_admin.
- Complete cycle stages: Test Scripts & Runs, Test Approval, Live Scripts & Runs, Post-Live Approval, Notifications, Closed.
- Issue lifecycle across all three contexts: finance_test_review, execution_issue, post_live_observation.
- Move-to-Live gate with Finance issue blocking, Finance approval via mocked webhook, issue completion.
- Post-Live observation creation and completion.
- Notification generation (billing user only).
- Audit trail and issue-reporting summary evidence.
- All three Entra-auth-mode browser scenarios from Package 12A verified.
- RouteErrorBoundary failure surface verified.
- Broken Help markdown image reference repaired.
- Entra-auth-mode deterministic browser test added to the test suite.

## Files changed

- `backend/tests/test_rg01_package12_rehearsal.py` (new)
- `frontend/tests/fake-msal-browser.js` (new)
- `frontend/tests/entra-auth-mode.mjs` (new)
- `frontend/tests/route-error-boundary.mjs` (new)
- `frontend/tests/route-error-boundary.html` (new)
- `frontend/tests/route-error-boundary-test.jsx` (new)
- `frontend/vite.entra-test.config.js` (new)
- `frontend/package.json` (scripts added)
- `docs/platform/billing_user_guide.md` (image path corrected)
- `docs/RG01_ALIGNMENT_TRACKER.md` (updated)
- `docs/VERIFICATION_MATRIX.md` (updated)
- `docs/rg01-handoffs/package-12b-latest.md` (new)

## Tests / checks run and real results

- Backend focused auth tests (test_entra_dual_auth, test_entra_auth_service, test_auth_roles): 35 passed.
- Full backend suite (120 tests including new rehearsal test): 120 passed.
- Frontend lint: 0 errors, 1 pre-existing TanStack warning.
- Frontend build: pass; main entry ~777.78 kB raw / 222.55 kB gzip.
- Entra-auth-mode browser tests (6 scenarios): all 6 passed.
- RouteErrorBoundary browser test: passed (error boundary surface and Reload button visible).
- Help image reference fixed.
- All disposable containers/servers/temp files cleaned up.

## Safety reconciliation

- `.serena/project.yml` left unchanged.
- No commit, push, deploy, production migration or auth rollout performed.
- No `.env*` files with real values read or created.
- `billing_postgres` not used by Package 12 tests.
- Package 12A changes preserved; 12B added test-only files and doc fixes.

## Remaining external gates (Package 4 / RG-01 final acceptance)

1. Real Finance/Billing monthly-cycle pilot with actual participants.
2. Finance confirmation or amendment of the issue-classification vocabulary.
3. Routine-use evidence and business acceptance.
4. Entra rollout decision and production deployment/operations evidence when authorized.
5. Populate Issue Reporting test fixtures in a future QA package if live sort/pagination coverage is required.
6. Production Entra cutover timing decision.

## Decision

Packages 0–3 and 5–10 are technically accepted. Package 12A (Entra-only cutover) is complete. Package 12B (synthetic rehearsal, quality backlog, tests) is complete. RG-01 remains technically ready for a controlled Finance/Billing pilot, not formally complete, deployed or handed over.