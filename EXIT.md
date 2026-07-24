# EXIT.md — Billing Collaboration Platform

Production handover record for this application, per the format requested in
`06_ENTRA_ID_INTEGRATION_GUIDE.md` §18. Keep this file up to date as Entra
rollout (Task 9 of `docs/plans/2026-07-21-revenue-protection-issue-control.md`)
progresses — it is the single place a future maintainer or support owner
should look for "what is this app, what does it depend on, who owns it."

## Application

- **Name:** Billing Collaboration Platform
- **Repo:** this repository (Entra work merged to `main` 2026-07-23 via PR #2)
- **Frontend base URL:** `https://n8n-lan.cwsey.com/billing/`
- **Backend public API base URL:** `https://n8n-lan.cwsey.com/billing-api/`
- **Deployed via:** GitHub Actions on push to `main` → sync to `/opt/billing`, backend/frontend env rewrite, `systemctl restart billing-api` (see `docs/entra-id-integration-plan.md` "Deployment And Environment Impact")

## Entra Registration Record

Azure AD app registration has **not yet been created** for this application as
of 2026-07-22. `ENTRA_ENABLED=false` in production; local username/password
auth is the only active path. Fill in this table once the registration is
performed (per `06_ENTRA_ID_INTEGRATION_GUIDE.md` §5–§8), and keep it current
through every Task 9 rollout phase.

| Field | Value |
| --- | --- |
| App registration name | `Billing Collaboration Platform` |
| Enterprise application name | `Billing Collaboration Platform` (confirmed — matches the app registration name) |
| Tenant ID | `97df7dc2-f178-4ce4-b55e-bcafc144485e` |
| Client ID (Application ID) | `ff645f66-7fab-4907-8ed0-3f232af516f8` |
| Object ID | `f933caef-130c-4893-ae89-06246affd109` |
| Application ID URI | `api://ff645f66-7fab-4907-8ed0-3f232af516f8` (confirmed) |
| API scope(s) | `access_as_user` |
| Redirect URLs | `https://n8n-lan.cwsey.com/billing/` (prod), `http://localhost:5173/` (local dev) — SPA platform, no implicit grant |
| Post-logout URLs | `https://n8n-lan.cwsey.com/billing/` |
| App roles | `finance_user`, `billing_user`, `system_admin` (exact three — no additional roles; `viewer` was retired in commit `8f6d8db` and must not be re-added) |
| Assigned groups | Role mapping uses Entra **app roles** via the `roles` claim (see `entra_auth_service._claims_to_role`). One security group per role, assigned to its matching app role in the Enterprise Application: `Billing-App-SystemAdmin` → System Admin, `Billing-App-BillingUser` → Billing User, `Billing-App-FinanceUser` → Finance User (confirmed). Gregory added to `Billing-App-SystemAdmin`. |
| Request/approval reference | not needed — Gregory holds Entra admin rights directly |
| Support owner | Gregory Panagary |

**Registration complete as of 2026-07-23.** Redirect URIs, API scope, app roles, and role-to-group assignment all done in Entra. `ENTRA_ENABLED` remains `false` in production — nothing above changes production behavior until Phase A/B are explicitly approved.

## Rollout status (Task 9)

Tracks the phased rollout defined in `docs/entra-id-integration-plan.md`
("Recommended rollout phases") and `docs/plans/2026-07-21-revenue-protection-issue-control.md`
Task 9. Update the checkbox and date as each phase actually completes in
production — do not check a box from local/disposable-stack testing alone.

**Phase A prerequisites (2026-07-24 status):**
- [x] Production `alembic stamp head` run successfully — deploy pipeline (migration → restart → health check) confirmed green on `main` as of commit `1c9eb0f`.
- [x] Local 3-role login smoke test passed (billing/finance/admin, against a disposable Postgres) — `/auth/me` role mapping and `/api/issue-reporting/summary` role enforcement (403 billing, 200 finance) both verified.
- [x] **Done 2026-07-24.** `BILLING_ENTRA_ENABLED`/`BILLING_ENTRA_TENANT_ID`/`BILLING_ENTRA_CLIENT_ID` added as GitHub Actions secrets (Gregory-approved) and confirmed correctly resolved into production's `.env`/`.env.production` on deploy run `30069485695` (`ENTRA_ENABLED`/`ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` all show as populated/masked in the write-env step log, `health_status=active` after restart). Note: the very first deploy attempt right after adding the secrets (`30069229348`) resolved `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` as empty due to secrets-propagation timing — re-running the workflow a few minutes later resolved cleanly. `authority`/`issuer`/`audience`/`jwks_url`/`redirect_uri`/`api_scope` were left unset, relying on the safe derived defaults in `entra_auth_service.py` and `frontend/src/entra.js`.

**Phase A is now live in production** (`ENTRA_ENABLED=true`, deployed 2026-07-24). Local auth is unaffected. Not yet verified in a real browser: local login still works and the "Sign In With Microsoft" button renders — do this before checking the Phase A box below.

- [ ] **Phase A — passive backend support:** deploy with `ENTRA_ENABLED=false`; confirm local auth unchanged, service healthy.
- [ ] **Phase B — controlled Entra enablement:** small pilot group assigned in Entra; confirm sign-in, `/auth/me` via Entra token, correct role, `403` for unassigned users, local users still work.
- [ ] **Phase C — business workflow testing:** pilot group exercises a non-destructive test cycle (create/complete/reopen Finance issues, Move-to-Live gate) end to end under Entra auth.
- [ ] **Phase D — cutover:** stable pilot period elapsed; schedule local login/signup retirement; confirm no local-auth path remains as an undocumented bypass; rollback plan re-confirmed.

## Rollback

If Entra rollout causes a production issue at any phase:

1. Set `ENTRA_ENABLED=false` (backend) and `VITE_ENTRA_ENABLED=false` (frontend).
2. Redeploy (this is the existing GitHub Actions push-to-`main` path).
3. Local username/password auth continues to work throughout — it is never disabled by this rollout until Phase D is explicitly signed off.
4. Investigate before re-attempting enablement; do not re-enable without root-causing the failure.

Local auth is only retired in Phase D, after a stable pilot period — see
`docs/entra-id-integration-plan.md` "Rollback strategy" for the authoritative
version of this procedure.

## Known dependencies / gotchas for whoever runs this next

- ~~Production has never had `alembic stamp head` run~~ **Done 2026-07-24** via the `stamp-production-db` workflow; `alembic current` on production now reports `6ab1c9b21c7b (head)`. See `docs/DEPLOYMENT_SAFETY.md`.
- `frontend/.env`/`.env.local` hardcode `VITE_API_URL=http://localhost:8000/api` for local dev; disposable frontend test runs need an explicit override (see plan tracker `shiny-brewing-mango.md` Handover notes for the exact technique).
- CORS `allow_origins` in `backend/app/main.py` is hardcoded to `http://localhost:5173` — a disposable frontend on another port needs a temporary addition, reverted before any commit.
