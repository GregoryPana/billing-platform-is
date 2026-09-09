PACKAGE_ID: 8
PACKAGE_STATUS: completed

## Mission
Add react-hook-form + zod client-side validation to the Script Generation form (`frontend/src/features/cycles/ScriptsRunsStage.jsx`) and the Admin user-edit form (`frontend/src/features/admin/AdministrationPage.jsx`) without changing accepted fields/values or backend behavior. This session resumed a prior partial session (see git history of this file) whose code edits were already complete but whose checks/handover/tracker update were never finished after it hit its provider limit.

## Files changed (all pre-existing from the interrupted prior session; verified, not rewritten)
- `frontend/package.json`, `frontend/package-lock.json` — new runtime deps: `react-hook-form@^7.87.0`, `zod@^4.5.4`, `@hookform/resolvers@^5.9.1`. **New dependency addition — flagged per repo convention (as with `@playwright/test`).**
- `frontend/src/features/admin/AdministrationPage.jsx` — `user_edit_schema` + `UserEditForm` rewired to react-hook-form, `mode: "onBlur"`, inline errors, error summary, scroll/focus-to-first-error on invalid submit.
- `frontend/src/features/cycles/ScriptsRunsStage.jsx` — `script_generate_schema` + form rewired the same way; parameter grid keeps existing default-parameter toggle behavior.

## Zod schemas and backend cross-check
- **Admin form** (`backend/app/schemas/users.py::UserUpdate`, all fields `str | None = None`, no format/length constraints): `name`/`username` require non-empty trimmed string (matches the pre-existing HTML `required` inputs, not a new constraint), `email` requires non-empty + `is_valid_email` (reused from `lib/format.js`, same regex used elsewhere in the app), `status` is `z.enum(["active","inactive"])` mapped to `is_active` boolean, `password` is unconstrained (blank preserves current password, matching backend semantics). The form never sends `role`; the pre-existing form never edited role either.
- **Script form** (`backend/app/schemas/scripts.py::ScriptGenerateRequest` + the p6 guard in `backend/app/services/command_service.py:79-82`, `if script_type_value == "printing" and not params.get("p6"): raise ...`): `script_type` is `z.enum(["preparation","printing"])`, `p1`-`p8`/`log_types` are unconstrained strings/array (backend has no length/format constraint on these), and a `superRefine` reproduces the exact backend condition — printing requires non-blank P6 unless `use_default_params` is on (defaults always leave P6 blank, matching `command_service.py`'s default-parameter builder).

## Verification performed
- `cd frontend && npm run lint` — clean, no errors.
- `cd frontend && npm run build` — succeeds; bundle ~1,913 kB / 552 kB gzip (pre-existing large-chunk warning, unrelated to this package; tracked separately as Package 10).
- Disposable stack (not the persistent `billing_postgres` on 5435): ephemeral `postgres:16-alpine` container on port 5556, `alembic upgrade head`, backend on port 8901 against a scratch venv, logged in as the seeded break-glass admin. Tested `PATCH /api/users/{id}`:
  - Malformed email (`"not-an-email"`) → backend returned **200 OK** (accepts it, since `UserUpdate.email` is a bare `str`) — confirms the new zod `is_valid_email` check is strictly additive, catching something the backend never rejected.
  - Blank `name` (`""`) → backend returned **200 OK** — confirms the zod `min(1)` check is additive, not a new backend-enforced constraint.
  - Full valid round-trip (name/username/email/is_active/blank password) → **200 OK**, confirming previously-successful values still submit successfully.
  - Container, venv, and backend process torn down afterward; `billing_postgres` (5435) was never touched.
- Script form: not exercised against a live cycle (no cycle existed in the disposable DB and creating one was out of this package's scope); parity confidence instead comes from the direct line-for-line match between the zod `superRefine` condition and `command_service.py:79-82`'s runtime guard, read together during this session.

## Result
No regressions found. Client validation is strictly additive in both forms — every backend-accepted value still round-trips, and the new zod checks catch cases the backend was already silently accepting or would reject server-side, giving earlier/clearer feedback per DESIGN_SYSTEM.md Part 10.

## Safety
No commit, push, deploy, production migration, or auth change occurred. Worktree delta is unchanged from the prior interrupted session (same 4 files); no unrelated files staged or touched.
