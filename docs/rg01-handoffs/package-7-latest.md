PACKAGE_ID: 7
PACKAGE_STATUS: completed

## Scope
Package 7 (maintainability backlog): accessible info-tips explaining domain vocabulary in the Cycle Workspace UI. No parameter default, calculation, or backend logic changed. No commit/push/deploy.

## Files changed
- New: `frontend/src/components/ui/info-tip.jsx` — `InfoTip` primitive, markup/classes copied verbatim from `DESIGN_SYSTEM.md` §9.2 (18px "i" button, `role="tooltip"`, `aria-describedby`, hover- and focus-accessible via `group-hover`/`group-focus-within`), plus an `onKeyDown` Escape→blur handler so keyboard users can dismiss without tabbing away (behavior-only addition, no markup/class change).
- Modified: `frontend/src/features/cycles/CycleWorkspacePage.jsx` — added `InfoTip` next to each of the 6 stage tab labels (Details, Test Scripts & Runs, Test Approval, Live Scripts & Runs, Post-Live Approval, Notifications), rendered as a sibling `<span>` next to each `role="tab"` button rather than nested inside it (a `<button>` cannot validly contain another interactive `<button>`, and nesting would also double-fire the tab's `onClick`). Tip text reuses the existing `stage_descriptions` object already in the file.
- Modified: `frontend/src/features/cycles/ScriptsRunsStage.jsx` — added `InfoTip` to the script type `<select>` label, the Cycle types checkbox-grid label, and select P1-P8 fields (content varies by selected script type).

## Source citations (every explanation written)
- Stage labels/descriptions: `CycleWorkspacePage.jsx`'s own `stage_descriptions` object (lines 14-21) — no new claim, reused verbatim.
- Script type: "Preparation runs bill-generation; Printing runs bill-printing and needs P6 from a completed preparation run" — `backend/app/services/command_service.py` lines 91-99 (executable paths `pspbil0101b.sh` vs `bil0705s.sh`) and `docs/platform/billing_process.md` §3.1/§3.2 headers.
- Cycle types: "Cerillion bill cycle code; A1A = Seychelles currency, A1U = USD" — `command_service.py` `CYCLES` list + `billing_process.md` "Move Third Party Payer Accounts to A1A or A1U" section (explicit currency mapping).
- Preparation P1 (cycle code), P2 (T/N test flag): `command_service.py` `_default_preparation_params` lines 24-36; `billing_process.md` §3.1 example `P1='M1A' P2='T'`.
- Preparation P3 (run date, first of next month): `command_service.py` lines 25-30 (`first_of_next_month`).
- Preparation P6/P7/P8: "not used for preparation scripts" — `_default_preparation_params` leaves them empty; only `_default_printing_params` sets them.
- Printing P2 (PBCC/PTEST packed, PITM left unexplained as a fixed flag): `_default_printing_params` line 46; `billing_process.md` §3.2 example.
- Printing P3/P4 (first/last day of usage month): `_default_printing_params` lines 40-48.
- Printing P6 (billing run UID, required): `generate_parameters` lines 79-83, the explicit `HTTPException` message "Printing scripts require p6 billing run uid," corroborated by `billing_process.md` §3.4's SQL query `billing_run_uid=2002` matching the doc's `P6='2002'` example.

## Open items — left unexplained, no info-tip added
Could not confidently trace exact business meaning beyond the literal default value in code:
- Preparation P4 (default `"28"`), P5 (default `"2"`).
- Printing P1 (constant `"S"`), P5 (constant `"N"`), P7 (constant `"0"`), P8 (constant `"99999999"`).
- Printing P2's `PITM=Y` component — packed-string presence is documented but its meaning ("print items"?) is not confirmed anywhere in the two source files.

## Checks run
- `npm run lint` — pass, zero errors.
- `npm run build` — pass (~2m25s; pre-existing >500kB chunk warning only, unrelated).
- Keyboard verification: disposable Playwright harness mounting `InfoTip` standalone (served by a throwaway `vite --port 5822`, deleted/killed after). Confirmed via computed `opacity`: hidden by default; Tab focuses and opens it; Escape blurs and closes it; Tab-away also closes it. Did not exercise the tips inside the live authenticated Cycle Workspace — that would require the full disposable Postgres/FastAPI/seeded-role stack from Packages 3/5/6; the harness verifies the shared primitive directly and both edited files mount the identical markup.

## Cleanup
Deleted `frontend/pkg7-harness.html`, `frontend/src/pkg7_infotip_harness.jsx`, `pkg7_verify.mjs`; killed the disposable vite process; confirmed via `git status --porcelain` that only the three intended files changed and via `ss -ltnp` that the disposable port is clear.

## Next safe action
Package 8 (React Hook Form and Zod hardening), contingent on the usage gate.
