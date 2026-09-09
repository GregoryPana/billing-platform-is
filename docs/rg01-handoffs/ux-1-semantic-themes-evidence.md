# RG-01 UX-1 — Semantic theme foundation evidence

**Branch:** `feature/rg01-ux-1-semantic-themes`
**Base:** candidate `06631b6`
**Scope:** UX-1 only. No UX-2 shell/navigation/page-header work.

## Authority and design route

- UX-1 requirements: `docs/RG01_UI_UX_DESIGN_SYSTEM_ALIGNMENT_PLAN.md`, synchronized into this worktree with the approved UX-0 direction, UX-1 local implementation state and remaining integration/acceptance gates.
- Product authority: `DESIGN_SYSTEM.md` and `docs/DESIGN_SYSTEM_ADDENDUM.md`.
- Repository workflow: `AGENTS.md`, `OPENCODE.md`, `.opencode/skills/cws-billing-platform-change/SKILL.md`, `docs/AGENT_DESIGN_SKILLS.md`, and `docs/agent-skills/project-flow-mapping/SKILL.md`.
- Design route supplied by Hermes: `cws-saas-product-ui`, existing shadcn-compatible primitives, restrained CSS motion, `interface-polish-engineering`, and the frontend design-quality gate.

The candidate already provided `:root`/`.dark` variables, a semantic Tailwind map, and a saved light/dark toggle. UX-1 closes the remaining bounded gaps rather than replacing that foundation.

## Changes

- `frontend/index.html`
  - synchronous pre-paint theme bootstrap;
  - valid saved preference wins;
  - otherwise the operating-system color-scheme preference initializes the page;
  - applies the root class and `color-scheme` before the React bundle mounts.
- `frontend/src/lib/theme.js`
  - central theme key, resolution, application, and React hook;
  - theme fallback is not persisted until the user changes it, so a missing saved preference remains system-derived;
  - storage failures do not prevent an in-memory theme choice.
- `frontend/src/components/layout/Sidebar.jsx`
  - uses the shared theme hook; no navigation or sign-out behavior changed.
- `frontend/src/App.css`
  - complete light/dark semantic values for success, warning, destructive and info;
  - added `--info` and `--info-foreground`;
  - added `--warning-soft-foreground` so tinted warning states do not require component-level dark-mode overrides;
  - tuned semantic tones/foregrounds so solid and 15%-tinted normal-text pairs clear 4.5:1;
  - warning states use the bright semantic tone in dark mode;
  - added semantic info/success alert and info pill bridge classes.
- `frontend/tailwind.config.js`
  - maps the info semantic pair and warning soft-foreground role.
- `frontend/src/components/ui/badge.jsx`
  - adds the info variant and fixes warning text in dark mode.
- `frontend/src/components/billing/CycleProgressTracker.jsx`
  - fixes the same warning-text contrast in the current-stage chip; workflow logic is unchanged.
- `frontend/src/features/dev/ThemeReviewPage.jsx`
  - internal component/state review surface for tokens, typography, buttons, focus, badges, pills, alerts, forms, tables, empty states and skeletons;
  - full token labels remain visible at mobile width;
  - available only through the development route and absent from application navigation.
- `frontend/src/App.jsx`
  - lazy import and `/dev/theme-review` route both gated by `import.meta.env.DEV`;
  - production auth bootstrap and product routes are unchanged.
- `frontend/tests/ux1-theme-init.mjs`
  - verifies saved dark/light, system dark/light fallback, bootstrap/module parity, and root theme state before React mounts.
- `frontend/tests/ux1-theme-review.mjs` plus standalone test entry/HTML
  - verifies both themes at 375, 768, 1024 and 1440 pixels, distinct rendered theme backgrounds, populated badge/info specimens, keyboard focus, document and element-level overflow, reduced motion, no browser errors or failed requests, and semantic contrast;
  - guarantees Vite termination with graceful shutdown plus forced-kill fallback.
- `frontend/tests/ux1-theme-storage.mjs`
  - verifies that a user-selected theme survives a full reload;
  - verifies the in-memory toggle still works when browser storage reads and writes are blocked.
- `frontend/package.json`, `frontend/package-lock.json`, and `frontend/src/lib/icons.js`
  - add the focused test scripts and the deterministic design-conformance gate;
  - replace the superseded Lucide dependency with the approved Tabler icon system through a tree-shakeable local icon facade.

## Design-skill refresh and approval — 2026-09-09

- Gregory explicitly approved the established professional operational-SaaS direction; this closes the UX-0 direction-choice gate only.
- The refreshed `design-skill-stack`, `cws-saas-product-ui`, `interface-polish-engineering`, and `frontend-design-quality-gate` guidance was compared with `DESIGN_SYSTEM.md`, `docs/AGENT_DESIGN_SKILLS.md`, the implemented UX-1 tokens, and current frontend dependencies.
- The semantic theme architecture, IBM Plex Sans typography, restrained operational hierarchy, accessible states, responsive review surface, and status-only semantic colour model remain aligned; they did not need redesign.
- Concrete refresh changes applied:
  - migrated the product icon system from Lucide to Tabler;
  - prohibited decorative sparkle/star-burst iconography and lateral accent rails for selected states;
  - replaced broad `transition-all` usage in the touched progress surfaces with property-specific transitions;
  - added explicit empty-state, dense-layout, and `Extract / Adapt / Reject` benchmark rules;
  - added a repository-local design-conformance scanner and package command.
- Initial direct-barrel Tabler imports caused slow development transformation. A local icon facade now imports only the required icon modules; the focused responsive theme review subsequently passed at all four widths.

## Semantic token reference

| Meaning | Light | Dark |
|---|---|---|
| Background / foreground | `214 50% 98%` / `222 47% 11%` | `220 45% 10%` / `210 40% 96%` |
| Card / card foreground | `0 0% 100%` / `222 47% 11%` | `220 47% 13%` / `210 40% 96%` |
| Muted / muted foreground | `214 100% 98%` / `215 16% 35%` | `218 44% 19%` / `216 31% 70%` |
| Brand blue / foreground | `211 100% 36%` / `210 40% 98%` | `213 74% 53%` / `222 47% 11%` |
| Success / foreground | `152 67% 27%` / `210 40% 98%` | `152 67% 42%` / `222 47% 11%` |
| Warning / foreground | `48 100% 47%` / `222 47% 11%` | `48 100% 53%` / `222 47% 11%` |
| Warning soft foreground | `222 47% 11%` | `48 100% 53%` |
| Destructive / foreground | `0 63% 45%` / `210 40% 98%` | `0 84% 67%` / `222 47% 11%` |
| Info / foreground | `199 89% 31%` / `210 40% 98%` | `199 89% 58%` / `222 47% 11%` |

The focused browser test calculates WCAG relative luminance from the rendered CSS variables. It checks each semantic foreground on its solid tone and each normal semantic text tone on a 15%-tinted card surface in light and dark modes. The lowest measured ratio is **4.55:1**.

## Verification

- `git diff --check`: pass.
- Focused changed-file ESLint: pass with zero errors and zero warnings.
- Full `npm run lint`: passes with zero errors; one existing TanStack compatibility warning remains in `src/components/ui/sortable-table.jsx`.
- `npm run build`: pass. Only existing large-chunk warnings remain; the development review page does not produce a production chunk.
- `npm run test:ux1-theme-init`: pass for saved light/dark, system light/dark, blocked-storage/system-dark fallback and pre-React no-flash checks.
- `npm run test:ux1-theme-review`: pass at 375, 768, 1024 and 1440 pixels in both themes; distinct theme backgrounds, populated specimens, minimum semantic normal-text contrast 4.55:1, no document or element-level overflow, no console errors, no failed requests, focus ring detected, and reduced-motion duration verified at `1e-05s`.
- `npm run test:ux1-theme-storage`: pass for persisted dark-theme reload and in-memory fallback when storage is unavailable.
- `npm run test:route-error`: pass.
- `npm run test:auth`: all six scenarios pass on a clean Vite optimizer cache. An earlier combined run saw a transient `504 Outdated Optimize Dep`; the clean rerun passed without changing authentication code.
- Independent Playwright capture: current light/dark review surface rendered at 1280 and 360 pixels with zero console errors and `scrollWidth === clientWidth`.
- Independent diff review: the initial high-severity pre-paint initialization and semantic-contrast findings were remediated. Its remaining warning override, viewport-matrix, reduced-motion, specimen-population, overflow-depth and cleanup findings were also closed before final validation.

## Acceptance mapping

- Semantic neutral, brand, success, warning, danger and info variables: met in both roots.
- Saved/system initialization without theme flash: met and tested before React mount.
- WCAG AA normal-text contrast for semantic solid/tinted states: met; minimum 4.55:1.
- Hardcoded mode-specific semantic overrides: repository scan found none in component source; existing semantic roles remain the page contract.
- Internal theme/state review surface: met; development-only, no navigation entry, excluded from production.
- Typography, spacing, radius, border, elevation and restrained/reduced motion: existing constants retained; no second system introduced.
- Responsive and interaction evidence: 375, 768, 1024 and 1440 pixel browser checks pass in both themes; focus, localized overflow and reduced-motion assertions are included.

## Scope and release state

No backend, authentication behavior, API contract, workflow rule, schema, CI, deployment or infrastructure file changed. The frontend icon dependency and lockfile changed as documented above. UX-1 implementation commit `eb6a0fc` exists locally; the design-skill alignment is a separate follow-up local commit. Gregory's 2026-09-09 approval covers the UX-0 design direction only; it is not UX-1 integration approval, Finance/Billing acceptance, staging approval, deployment approval or production-release authorization. No push, merge, deployment, migration, production authentication change, or Entra cutover was performed. Package 12 must still integrate before UX-1; UX-2 has not started.
