PACKAGE_ID: 2
PACKAGE_STATUS: completed

# RG-01 Package 2 — Sign-in boundary copy, password-toggle, touch/contrast polish

**Branch/HEAD:** `feature/cycle-usage-month-derivation`, unchanged by this session (no commits made).
**Scope:** `frontend/src/features/auth/LoginPage.jsx` only, per instruction.

## Copy changes (before → after)

1. Subtitle:
   - Before: "Automated billing operations and approvals"
   - After: "Coordinates the monthly billing cycle and prepares commands and approvals — billing execution stays in Cerillion."
   - Source for the boundary wording: `docs/FINANCE_ISSUE_CONTROL_DESIGN.md` §1 ("The platform coordinates a monthly billing cycle...") and §10 ("no automated execution of Cerillion/billing commands"); `.opencode/skills/cws-billing-platform-change/SKILL.md` ("cycle coordination, backend command generation/preparation... It is not a billing engine and must not execute Cerillion/billing commands automatically"). `command_service.py` only builds/prepares script parameters, it does not invoke Cerillion.

2. Headline block:
   - Before: "Sign in to account" / "Enter your core credentials to continue."
   - After: "Sign in" / "Enter your email or username and password to continue."

## Touch-target — open decision for Gregory (not resolved)

The ~40px (`h-10`) inputs/buttons on this screen are the shared shadcn `Input`/`Button` tokens (`DESIGN_SYSTEM.md` §4.3, §4.1) used app-wide. `DESIGN_SYSTEM.md` §11 sets the accessibility floor at "Touch targets ≥ 40px on mobile" — 40px meets that floor exactly, it does not fail it. I made no token change. Decision needed: (a) accept 40px as the permanent house standard, or (b) raise the shared token to 44px as a separate, coordinated follow-up package (it would silently change every button/input across the app and needs its own testing pass).

## Contrast measurement

Footer text "Authorized personnel only" used `text-muted-foreground` (`hsl(215 16% 35%)`) plus `opacity-70`, on the white `bg-card` surface.

- Computed via WCAG relative-luminance formula (awk, hand-verified against the CSS HSL token values): full-opacity contrast = **7.35:1** (passes AA comfortably).
- With the pre-existing `opacity-70` compositing over white: **3.52:1** — below the 4.5:1 AA requirement for normal text (`text-xs` is not "large text", so the 3:1 large-text threshold doesn't apply).
- Action taken: removed `opacity-70` from that one `<span>`. No other class/token touched. Restores it to the underlying 7.35:1 token contrast.

## Password toggle

Added `Eye`/`EyeOff` (lucide-react, already the project's icon library) next to the existing "Show"/"Hide" text, plus `aria-pressed={show_login_password}` on the `<button>`. The accessible name still comes from the visible "Show"/"Hide" text (icons are `aria-hidden`), so no regression in the toggle's accessible name/state; it remains a native, keyboard-reachable `<button type="button">`.

## Verification

- `cd frontend && npm run lint` — pass, no errors/warnings.
- `cd frontend && npm run build` — pass (`vite build`, ~1m45s; pre-existing >500kB chunk-size advisory, unrelated).
- Visual: disposable `vite --port 5799 --strictPort` dev server, Playwright screenshots at 1440×1000 and 390×844 (both default and password-shown states). No clipping/overlap at either breakpoint; subtitle/headline copy wraps cleanly; toggle icon+label swap correctly; footer text visibly more legible. Dev server killed afterward; all scratch files (`shot.mjs`, PNGs, temporary `package.json` "shot" script) deleted — nothing left behind.
- Entra sign-in path (`entra_enabled` block) untouched; not rendered in this local dev config so not visually re-verified, but no lines in that branch were edited.

## Housekeeping note

The Edit tool initially rewrote `LoginPage.jsx` (and a throwaway `package.json` edit used only to run the screenshot script) from the repo's native CRLF line endings to LF, which would have produced a whole-file diff. Corrected both back to CRLF (`sed` for the edited file; `git checkout` for `package.json`, whose only change was the temporary script and is now identical to HEAD) so the tracked diff for this package is minimal: `frontend/src/features/auth/LoginPage.jsx` is the only file with a real content change.

## Not done / out of scope (per instruction)

No password-recovery flow added, `handle_login_submit` untouched, no logo image, Entra sign-in behavior untouched, no shared design-token change, no commit/push/deploy.
