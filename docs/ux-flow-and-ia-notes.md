# Billing Platform — Flow Map & IA Restructure (implemented)

**Date:** 2026-07-07 (updated same day)
**Status:** The IA restructure proposed in §3 has now been **implemented** (second pass, 2026-07-07) on top of the visual redesign. §1–2 are kept as the record of the pre-restructure app; §3 describes what is now built; §5 lists what changed and what remains.

---

## 1. Current system map

### 1.1 Roles and what they see

| View (nav item) | billing_user | finance_user | system_admin | viewer |
| --- | --- | --- | --- | --- |
| User Guide | ✔ | ✔ | ✔ | ✔ |
| Overview | ✔ | ✔ | ✔ | ✔ |
| Billing Cycles | ✔ | – | ✔ | – |
| Script Generation | ✔ | – | ✔ | – |
| Runs Tracking | ✔ | – | ✔ | ✔ (read-only) |
| Approvals | ✔ (request) | ✔ (decide) | ✔ | ✔ (read-only) |
| Request Settings | ✔ | – | ✔ | ✔ (?) |
| Notifications | ✔ | – | ✔ | – |
| Audit Log | – | – | ✔ | – |
| View Documentation | ✔ | – | ✔ | ✔ |
| Admin | – | – | ✔ | – |

Notes: viewer having Request Settings but not Billing Cycles looks accidental; finance_user loses access to Documentation and Notifications history even read-only. Revisit the permission matrix deliberately during restructure.

### 1.2 The core workflow (a billing cycle's life)

One linear pipeline, currently spread across five nav destinations:

1. **Create cycle** (Billing Cycles) — usage month + billing month + notes. Status `draft` = "Test Run Phase".
2. **Generate test scripts** (Script Generation) — pick cycle, environment=test, script type (preparation/printing), cycle types (I1A…A1U), P1–P8 parameters (defaults derived from the cycle month). Export as .log files for manual execution on the billing host.
3. **Record test runs** (Runs Tracking) — per script: planned → executed/failed. All preparation+printing scripts executed ⇒ stage is "ready".
4. **Request test approval** (Runs Tracking button → Approvals form) — billing selects finance recipients, sends email + records request. Stage `test` = "Move to live".
5. **Finance decision** (Approvals, finance view) — approve/reject with comments. Approval unlocks live script generation (`test_approved` = "Live Run Phase").
6. **Generate live scripts → record live runs** — same as 2–3 with environment=live.
7. **Request post-live approval** — stage `post_live` = "Move to notifications". Approval ⇒ "Notification Phase".
8. **Generate notification command** (Notifications) — date-stamped email/SMS Streamserve commands; download. Cycle completed (`post_live_approved`).

Cross-cutting: every action lands in the **Audit Log**; approval grants surface to billing users as an in-app banner (localStorage-diffed); data refreshes by polling everything every 30 s.

### 1.3 Secondary flows

- **Access:** login (local or Entra ID) → signup requests → admin approves with role assignment (Admin view).
- **User management:** admin creates/edits/deletes users directly.
- **Configuration:** Request Settings — finance recipient list, billing email (locked), default approval message (autosaved, debounced).
- **Reference:** User Guide (role-specific markdown, PDF export) and View Documentation (billing process doc + original PDF).

---

## 2. Friction points observed (why restructure)

1. **The pipeline is fragmented by feature, not by user intent.** Cycles, Scripts, Runs, Approvals, and Notifications are five separate views, each with its own cycle selector. A billing user walking one cycle through its life re-selects the same cycle up to five times and must know the correct view order. The `CycleProgressTracker` exists precisely because the IA doesn't express the sequence.
2. **Approvals mixes two audiences in one view.** Billing users see a *request* form; finance users see a *decision* queue; both share the route and part of the state. These are different jobs-to-be-done.
3. **Hidden state coupling between views.** The recipient checkboxes in Request Settings and the Approvals request form share the same `selected_finance_recipients` state — ticking a recipient in Settings silently changes who the next approval request goes to. Selection-of-recipients belongs to the *send* action; the *list* of recipients belongs to settings.
4. **Overview shows the progress tracker for `cycles[0]` only** — an arbitrary "latest" cycle, with no way to see other in-flight cycles side by side.
5. **Two nav items for help** (User Guide, View Documentation) split the same intent.
6. **Global header actions ignore context.** "Refresh" and "New Cycle" render on every view, including the Audit Log and the finance user's Approvals queue (New Cycle now hidden for finance/viewer, but the pattern remains).
7. **No routing/deep links.** Approval request emails contain `window.location.href`, which cannot point finance at the specific request. Everything is one URL.
8. **Monolith:** all 11 views live in one 3,200-line `App.jsx` with ~40 useState hooks; every 30 s poll reloads all six collections regardless of the active view; there are no loading states.
9. **Destructive/irreversible actions were unguarded** (user delete — a `window.confirm` was added as an interim; should become a proper dialog).
10. **Runs Tracking hosts an approval action** ("Request Approval") that then teleports you to the Approvals view with prefilled state — evidence that requesting approval is really a step in the run workflow, not a separate destination.

---

## 3. Target IA (group by user intent and workflow) — IMPLEMENTED 2026-07-07

Reorganize navigation around **three intents — operate, decide, administer — plus help**:

### 3.1 Operate (billing users' daily job)

- **Overview** — KPI cards + a *list of in-flight cycles*, each with its progress stepper and a "Continue" action that deep-links into the cycle workspace at its current stage.
- **Cycle Workspace** (`/cycles/:id`) — the big consolidation. One cycle-centric page with the progress stepper as primary navigation and the existing views folded in as stages:
  1. *Details* (create/edit cycle metadata)
  2. *Test scripts & runs* (generation + execution tracking together — they operate on the same objects)
  3. *Test approval* (request + status, recipients chosen at send time)
  4. *Live scripts & runs*
  5. *Post-live approval*
  6. *Notifications* (command generation + history for this cycle)
  Select the cycle once; every stage inherits it. Gating rules (live blocked until test approved, notifications blocked until post-live approved) become disabled steps with explanatory notes instead of scattered warning banners.
- A slim **All Cycles** list remains for creating cycles and finding old ones.

### 3.2 Decide (finance)

- **Approvals Inbox** (finance-only) — pending queue first, decision form as a drill-in (dialog or detail panel per request), history below. Deep-linkable per request (`/approvals/:id`) so the request email lands finance exactly on the item.
- Finance's Overview becomes their inbox summary; they never see billing-only operate tooling.

### 3.3 Administer (system_admin)

- **Administration** section grouping: *Users* (create/edit/delete), *Access Requests* (signup approvals), *Audit Log*, and *Settings* (the current Request Settings: recipient directory, default message, billing email). Settings stops carrying per-send selection state (see friction #3).

### 3.4 Help

- Single **Help** destination combining User Guide (role-aware) and Documentation, with in-page section navigation (DESIGN_SYSTEM.md §5.4 jump-nav pattern) instead of two nav items.

### 3.5 Enablers required by this IA

- **react-router-dom** with real routes per section and per cycle/approval — prerequisite for deep links from emails and for splitting the monolith into `features/<name>/` folders (DESIGN_SYSTEM.md Part 2 structure).
- **Scoped data fetching** per route (replace the global 30 s poll-everything) with skeleton loading states.
- **Permission matrix cleanup** (see §1.1 anomalies) done intentionally alongside the nav regrouping.

---

## 4. Pass 1 — the 2026-07-07 visual redesign (no IA change)

- **Tokens:** canonical CWS light + dark token sets (`--primary: 211 100% 36%` / dark `213 74% 53%`, success/warning/destructive semantics, radius 0.75rem) in `frontend/src/App.css`; Tailwind config extended with success/warning, container, shimmer, `tailwindcss-animate`.
- **Font:** IBM Plex Sans (+ JetBrains Mono for commands/IDs) via `index.html`; Manrope/Inter removed.
- **Legacy CSS:** every hand-rolled class (`.panel`, `.pill`, `.alert`, `.table*`, buttons, forms…) rewritten token-only — zero literal hex colors remain; light-mode cards are borderless + `shadow-sm`, dark mode defined from day one (no toggle yet).
- **Components:** shadcn-pattern primitives created in `src/components/ui/` (button, card, badge, input, select, textarea, label, skeleton, separator) for incremental adoption; bridge classes match them visually.
- **Feedback:** hand-rolled toast stack replaced with sonner (`<Toaster position="top-right" richColors closeButton />` in `main.jsx`); success/error toasts added to cycle create, approval decisions, notification generation, user delete.
- **Semantics:** progress tracker, status selects, pills, and banners now use success/warning/destructive tokens with the translucent fill pattern; user delete got a confirmation naming the user.
- **Shell & copy:** sidebar footer shows signed-in name/email + outline Sign Out; per-view page subtitles; Title Case on buttons/card titles; "New Cycle" hidden for finance/viewer.

## 5. Pass 2 — the IA restructure (implemented 2026-07-07)

The monolithic `App.jsx` was split into a routed, feature-foldered app:

```
src/
├── App.jsx                      # slim shell: auth bootstrap + HashRouter + role guards
├── context/AppDataContext.jsx   # data provider (collections, 30s poll, settings autosave, derived maps)
├── lib/format.js                # domain helpers + compute_cycle_steps / compute_stage_ready
├── components/
│   ├── ui/                      # shadcn-pattern primitives (+ confirm-dialog)
│   ├── layout/                  # nav.js (role-gated config), Sidebar, MainLayout
│   └── billing/                 # CycleProgressTracker, StatusBadge
└── features/
    ├── auth/LoginPage.jsx
    ├── overview/OverviewPage.jsx
    ├── cycles/CyclesListPage.jsx, CycleWorkspacePage.jsx,
    │          ScriptsRunsStage.jsx, ApprovalStage.jsx, NotificationsStage.jsx
    ├── approvals/ApprovalsInboxPage.jsx
    ├── admin/AdministrationPage.jsx  # tabs: Settings / Users / Access Requests / Audit
    └── help/HelpPage.jsx
```

What the restructure delivered against §2's friction points:

1. **Cycle Workspace** (`#/cycles/:id`) — select the cycle once; stages (Details → Test Scripts & Runs → Test Approval → Live → Post-Live Approval → Notifications) are tabs with lock icons and gating notes; the page lands on the cycle's current stage. (fixes #1, #10)
2. **Approvals Inbox** (`#/approvals`, finance + admin only) — pending queue with inline decision forms, history below, deep-linkable per request; approval request emails now link to the inbox instead of a blind URL. (fixes #2, #7)
3. **Recipient selection moved to send time** — the Settings page manages only the directory + default message; each approval request picks its recipients in the workspace form. (fixes #3)
4. **Overview** shows *all* in-flight cycles with progress bars and Continue buttons, not just `cycles[0]`; finance sees a pending-approvals summary instead of operate tooling. (fixes #4)
5. **Help** merges User Guide + Documentation into one destination with document tabs. (fixes #5)
6. **Contextual actions** — the global "New Cycle" header button is gone; creation lives on the Cycles page. (fixes #6)
7. **Routing** via HashRouter (`#/…`) — chosen over BrowserRouter so the deployed static hosting needs no history-fallback config; nav is 5 role-gated items (down from 11). Viewer no longer gets Request Settings; billing users reach Settings as their only Administration tab. (fixes #7, #8-nav, permission anomalies)
8. **ConfirmDialog** replaces `window.confirm` for user deletion; initial data load shows skeletons; dark-mode toggle added to the sidebar (persisted in localStorage).

### Remaining backlog

1. Finish bridge-class → `components/ui` migration inside stage/admin forms (`.form-grid`, `.table` etc. still used for layout), then delete the bridge classes.
2. Adopt react-hook-form + zod for the script generation and admin user forms (Part 10).
3. Add info-tips (§9.2) for domain terms: stages ("Move to live"), script types, P1–P8 parameters, cycle types.
4. Replace the 30 s poll-everything in `AppDataContext` with per-route scoped fetching.
5. Consider `@tanstack/react-table` for Audit Log (sort/filter/pagination) — it's the largest unbounded list.
6. Code-split routes (bundle is ~1.7 MB, mostly html2pdf + markdown; lazy-load the Help page).
7. If email deep links should open a *specific* request even before sign-in, add a post-login redirect to the originally requested hash.
