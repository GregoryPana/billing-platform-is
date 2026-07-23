# EXIT.md — Billing Collaboration Platform

Production handover record for this application, per the format requested in
`06_ENTRA_ID_INTEGRATION_GUIDE.md` §18. Keep this file up to date as Entra
rollout (Task 9 of `docs/plans/2026-07-21-revenue-protection-issue-control.md`)
progresses — it is the single place a future maintainer or support owner
should look for "what is this app, what does it depend on, who owns it."

## Application

- **Name:** Billing Collaboration Platform
- **Repo:** this repository (`feature/entra-id-auth` branch as of 2026-07-22; not yet merged to `main`)
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
| App registration name | _pending_ |
| Enterprise application name | _pending_ |
| Tenant ID | _pending_ |
| Client ID | _pending_ |
| Application ID URI | _pending_ (expected pattern: `api://<client-id>`) |
| API scope(s) | _pending_ (recommended: `access_as_user`) |
| Redirect URLs | _pending_ (expected: `https://n8n-lan.cwsey.com/billing/`, `http://localhost:5173/` for local dev) |
| Post-logout URLs | _pending_ (expected: same as redirect URLs) |
| App roles | `finance_user`, `billing_user`, `system_admin` (exact three — no additional roles; `viewer` was retired in commit `8f6d8db` and must not be re-added) |
| Assigned groups | _pending_ — decide whether role mapping uses Entra **app roles** (`roles` claim, preferred — see `entra_auth_service._claims_to_role`) or **security groups** (`groups` claim + `ENTRA_*_GROUP_ID` settings) before pilot enrollment |
| Request/approval reference | _pending_ — raise with the IT infrastructure / Microsoft 365 administration function per `06_ENTRA_ID_INTEGRATION_GUIDE.md` §3 |
| Support owner | Gregory Panagary |

## Rollout status (Task 9)

Tracks the phased rollout defined in `docs/entra-id-integration-plan.md`
("Recommended rollout phases") and `docs/plans/2026-07-21-revenue-protection-issue-control.md`
Task 9. Update the checkbox and date as each phase actually completes in
production — do not check a box from local/disposable-stack testing alone.

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

- Production has never had `alembic stamp head` run — this must happen before the Alembic-driven CI migration path in `.github/workflows/ci.yml` is live on `main`. See `docs/DEPLOYMENT_SAFETY.md`.
- `frontend/.env`/`.env.local` hardcode `VITE_API_URL=http://localhost:8000/api` for local dev; disposable frontend test runs need an explicit override (see plan tracker `shiny-brewing-mango.md` Handover notes for the exact technique).
- CORS `allow_origins` in `backend/app/main.py` is hardcoded to `http://localhost:5173` — a disposable frontend on another port needs a temporary addition, reverted before any commit.
