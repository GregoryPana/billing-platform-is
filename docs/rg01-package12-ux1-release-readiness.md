# RG-01 Package 12 + UX-1 Release Readiness Checklist

Updated: 2026-09-09
Candidate: `integration/rg01-package12-ux1-rc`
Candidate baseline: `eeff5758a0244cf83151155dc1ffcc15eaea4fe7`
Classification: Class C internal application

## Scope and release controls

- Package 12 authentication hardening precedes UX-1 in candidate history.
- Production authentication is Entra-only. Production startup must fail unless backend `AUTH_MODE=entra`.
- Production frontend must use `VITE_AUTH_MODE=entra`; a local-login production bundle is not acceptable.
- Local and synthetic checks support readiness but do not constitute real Entra validation.
- No push, shared merge, migration, deployment, authentication cutover or production rollout is authorized by this checklist.
- Rollback rehearsal is deferred by owner decision. The recovery procedure remains required and the deferral must be reassessed before production authorization if policy or risk review requires a rehearsal.

## Completed local evidence

- [x] Independent combined-candidate static review: APPROVE, no findings.
- [x] Backend suite: 130/130 tests passed.
- [x] Backend byte-compilation passed.
- [x] Frontend design-conformance, lint and production build passed.
- [x] Theme initialization, responsive theme review, blocked-storage persistence and route-error checks passed.
- [x] Six-scenario synthetic authentication harness passed.
- [x] Local backend health and frontend development/production-preview requests returned HTTP 200.
- [x] Dependency lockfile remediated to zero known `npm audit` findings without `--force`; frontend checks rerun successfully.

## Secure configuration prerequisites

Record only presence, owner and approved secret-store location. Do not place values in this document.

### Backend

- [ ] `ENVIRONMENT=production`
- [ ] `AUTH_MODE=entra`
- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `ENTRA_TENANT_ID`
- [ ] `ENTRA_CLIENT_ID`
- [ ] `ENTRA_AUTHORITY`
- [ ] `ENTRA_ISSUER`
- [ ] `ENTRA_AUDIENCE`
- [ ] `ENTRA_JWKS_URL`
- [ ] `ENTRA_FINANCE_GROUP_ID`
- [ ] `ENTRA_BILLING_GROUP_ID`
- [ ] `ENTRA_SYSTEM_ADMIN_GROUP_ID`

### Frontend build

- [ ] `VITE_AUTH_MODE=entra`
- [ ] `VITE_API_URL`
- [ ] `VITE_ENTRA_TENANT_ID`
- [ ] `VITE_ENTRA_CLIENT_ID`
- [ ] `VITE_ENTRA_AUTHORITY`
- [ ] `VITE_ENTRA_REDIRECT_URI`
- [ ] `VITE_ENTRA_POST_LOGOUT_REDIRECT_URI`
- [ ] `VITE_ENTRA_API_SCOPE`
- [ ] Redirect and logout URIs exactly match the deployed `/billing/` origin registered in Entra.

## Required identities and reviewers

- [ ] Finance-role test identity assigned to the approved Finance group/app role.
- [ ] Billing-role test identity assigned to the approved Billing group/app role.
- [ ] System-admin test identity assigned to the approved Admin group/app role.
- [ ] Unassigned test identity for denial validation.
- [ ] Inactive linked local user for `401` validation, using controlled test data.
- [ ] Named Finance/Billing acceptance reviewers.
- [ ] Named operational owner/reviewer.
- [ ] Authorized Entra/app-registration administrator available for configuration corrections.

## Real Entra validation gate

Run against an authorized non-production deployment slot where available. If no separate slot exists, production remains blocked until an explicitly approved controlled validation route is defined.

- [ ] Application redirects immediately to Microsoft; no local-login UI appears.
- [ ] Redirect returns to the exact `/billing/` URI.
- [ ] A genuine access token succeeds at `/auth/me`.
- [ ] Finance, Billing and Admin claims map to the correct application roles.
- [ ] Role-specific navigation and API authorization agree.
- [ ] Unassigned user receives `403`.
- [ ] Inactive linked user receives `401` and is not reactivated.
- [ ] Invalid, missing and local JWT credentials are rejected in Entra mode.
- [ ] Sign-out completes and returns to the configured URI.
- [ ] Audit records attribute activity to the correct actor.
- [ ] Browser console has no authentication errors after successful sign-in.
- [ ] No unexpected failed requests occur during the tested workflow.

Evidence to capture: deployed commit/artifact identifier, target environment, non-secret configuration-presence matrix, test identity labels, UTC timestamps, request status results, role matrix, console/network result and reviewer name.

## Finance/Billing acceptance gate

Use representative test data only unless a separately approved data plan permits otherwise.

- [ ] Billing can create or open a cycle and follow the expected operational stages.
- [ ] Billing can prepare scripts and record run outcomes within its permissions.
- [ ] Finance can review test results, record issues and complete the approval workflow.
- [ ] Billing has read-only visibility where required and cannot perform Finance-only actions.
- [ ] Open Finance issues block Move-to-Live server-side.
- [ ] Admin can perform the approved administrative workflow.
- [ ] Semantic light/dark themes, responsive layout, statuses and focus states are accepted.
- [ ] Finance/Billing acceptance decision and any exceptions are recorded.

## Operational acceptance gate

- [ ] Deployment source, target path, service name, runner and route/port ownership are confirmed.
- [ ] Current and target Alembic revisions are recorded; migration has a single reviewed head.
- [ ] Required secrets are present in the approved deployment store.
- [ ] Logs and support diagnostics are accessible to the operational owner.
- [ ] Monitoring/health checks and responsible owner are confirmed.
- [ ] Recovery procedure identifies the last known-good artifact and compatible configuration.
- [ ] Rollback rehearsal deferral is accepted or a rehearsal is scheduled if required by governance/risk review.
- [ ] Support and handover information is current.

## Deployment and production authorization

These remain separate explicit decisions:

- [ ] Authorization to push the candidate branch.
- [ ] Pull-request review and CI checks complete.
- [ ] Authorization to merge to the deployment source.
- [ ] Authorization to run migrations and deploy.
- [ ] Three-proof deployment verification captured:
  - service restart/uptime;
  - Alembic revision;
  - user-visible Entra-authenticated behavior.
- [ ] Finance/Billing acceptance recorded.
- [ ] Operational acceptance recorded.
- [ ] Explicit production rollout authorization recorded.

## Recovery procedure

Because production local authentication is prohibited, do not attempt recovery by switching `AUTH_MODE` or `VITE_AUTH_MODE` to `local`.

1. Stop the rollout and preserve logs and deployment metadata.
2. Restore the last known-good application artifact and its compatible configuration.
3. Restore the compatible database revision only through the reviewed migration/recovery procedure; never improvise destructive SQL.
4. Restart the service and record its activation timestamp.
5. Verify the expected Alembic revision.
6. Verify health and the user-visible behavior of the restored release.
7. Record the incident, decision owner and follow-up actions.

Status: procedure documented; rehearsal deferred and not claimed as passed.
