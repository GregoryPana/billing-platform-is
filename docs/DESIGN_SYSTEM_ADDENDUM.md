# Design System Addendum — Billing Collaboration Platform

This file is this repository's local counterpart to `DESIGN_SYSTEM.md` Appendix A, which inventories unrelated apps (`frontend/dashboard`, `frontend/dashboard-blueprint`, `frontend/survey`, etc.) that do not exist in this repository. This addendum records where `frontend/` (the Billing Collaboration Platform's actual frontend) stands against `DESIGN_SYSTEM.md`'s Part 2 Mandatory Stack, verified directly against `frontend/package.json`.

## A. Deviations from the mandatory stack

`DESIGN_SYSTEM.md:87-91` mandates `recharts` (charts), `framer-motion` (mount/unmount + state feedback), `react-hook-form` + `zod` (nontrivial forms), and `@tanstack/react-table` (sortable/paginated tables). The form and table packages are now present and used following RG-01 Packages 8 and 9; charting and motion libraries remain absent because the current product has no corresponding requirement.

| Package | Present? | Classification | Basis |
|---|---|---|---|
| `recharts` | No | Intentional design-route decision (current best assessment — not explicitly confirmed by the app owner) | No chart/graph UI exists anywhere in `frontend/src` (grep for chart/recharts turns up nothing). The product surfaces status via cards, tables, and a progress tracker, not data visualization. Not listed as a package in `docs/RG01_ALIGNMENT_TRACKER.md`'s Package 0–11 register, unlike the other three gaps below, so there is no tracked backlog item for it. |
| `framer-motion` | No | Intentional design-route decision (current best assessment — not explicitly confirmed by the app owner) | No motion/animation library usage exists anywhere in `frontend/src`. Same reasoning as `recharts`: not tracked in the RG-01 package register, and no state-feedback/mount-unmount animation currently exists to migrate. |
| `react-hook-form` + `zod` | Yes | Aligned | Package 8 is complete. The dependencies are declared in `frontend/package.json` and used for nontrivial forms, including administration and script-run workflows. |
| `@tanstack/react-table` | Yes | Aligned | Package 9 is complete. The dependency is declared in `frontend/package.json` and used by the shared sortable-table implementation. |

The `recharts`/`framer-motion` classification is inferred from the absence of any chart or animation-heavy UI in the current product plus the absence of a corresponding RG-01 package — it has not been separately confirmed with Gregory as a deliberate decision. If a chart or motion-driven feature is proposed later, resolve the classification with the app owner before deviating further from `DESIGN_SYSTEM.md`.

## B. Current-state inventory (local Appendix A equivalent)

| Item | State | Notes |
|---|---|---|
| App | `frontend/` (Billing Collaboration Platform) | Only frontend app in this repository — no multi-app inventory applies here. |
| Language | JS (`.jsx`), no TypeScript | `react`/`react-dom` 19.2.0. |
| Routing | `react-router-dom` ^7.18.1, `HashRouter` | `frontend/src/App.jsx` (154 lines) is a routing shell with a `RequireRole` guard; feature logic lives under `frontend/src/features/*`. |
| Toasts | `sonner` ^2.0.7 | Matches `DESIGN_SYSTEM.md`'s canonical toast library. |
| Forms | `react-hook-form` + `zod` for nontrivial forms; local state for simple controls | Package 8 complete. |
| Tables | Shared sortable table backed by `@tanstack/react-table` | Package 9 complete. |
| Charts | None present | No `recharts` or any charting library — see A above. |
| Motion | None present | No `framer-motion`/GSAP — see A above. |
| Styling | Tailwind CSS ^3.4.1, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate` | |
| Auth SDK | `@azure/msal-browser` ^4.26.0 | Entra ID is the primary auth path; see `docs/entra-id-integration-plan.md`. |
| PDF export | `html2pdf.js` ^0.14.0 | |
| Markdown | `react-markdown` ^10.1.0 | |
| Icons | `lucide-react` | |
| Testing | `@playwright/test` (devDependency) present; no unit/component test runner configured | No frontend automated test suite currently runs beyond lint/build; see `README.md` Current Known Gaps. |
| Build tooling | Vite ^7.2.4, ESLint ^9.39.1 | |

This table reflects `frontend/package.json` as read at the time of this addendum. Re-verify against the live file before relying on it for planning — dependency state changes as Packages 8–9 progress.
