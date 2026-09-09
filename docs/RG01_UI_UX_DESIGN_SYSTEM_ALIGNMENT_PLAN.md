# RG-01 UI/UX and Design-System Alignment Plan

**Product:** Billing Collaboration Platform
**Objective:** `RG-01`
**Plan status:** UX-0 design direction approved on 2026-09-09; UX-1 implemented and validated on its local feature branch; integration and business/release acceptance remain pending
**Prepared:** 2026-09-03
**Evidence boundary:** Local repository code and documentation, stored Billing screenshots, stored Work & Objectives screenshots, and a locally rendered Codex Usage dashboard. This is not evidence of production deployment or business acceptance.

## 1. Decision and intended outcome

RG-01 currently uses sound professional SaaS patterns, but it is not yet visually aligned enough to claim direct membership of the same product family as the recent Work & Objectives and Codex Usage dashboards.

The application will be aligned through an evolutionary redesign, not a rebuild. The work will:

- retain the current billing information architecture and completed functional improvements;
- introduce first-class dark and light themes using semantic tokens;
- make the dark theme visually consistent with the recent near-black/navy professional dashboards;
- give the light theme a controlled light-blue canvas and surface direction;
- align the shell, hierarchy, density, components, states and responsive behaviour;
- rewrite product copy and role-specific user guidance in plain, natural language for non-technical Billing and Finance users;
- remove emoji from all user-facing application copy, help content and generated guide output;
- make toasts, inline guidance and accessible information tips consistent, useful and easy to understand;
- preserve the role model, billing workflow, approval gates, issue controls, reporting behaviour and Entra-only security direction;
- establish repeatable visual and accessibility checks so alignment is demonstrated by rendered evidence rather than documentation alone.

Work & Objectives is the main reference for operational shell, hierarchy and workflow clarity. Codex Usage is the main reference for compact metrics, status visualisation, dense controls and dark-surface polish. RG-01 will use the shared principles rather than copy either application literally.

## 2. Non-negotiable preservation boundary

The redesign must not change the meaning or sequence of the monthly billing process:

1. create or select a billing cycle;
2. generate and record test scripts/runs;
3. request and receive Finance test approval;
4. generate and record live scripts/runs;
5. request and receive post-live approval;
6. prepare notifications and close the cycle;
7. preserve audit and issue evidence throughout.

The following are protected unless separately authorised:

- route and deep-link behaviour;
- role visibility and permission checks;
- Finance approval gates and status transitions;
- issue classification, activity and reporting semantics;
- API contracts, persisted data and database schema;
- Entra/session/authentication behaviour;
- Cerillion boundary: the platform coordinates work and prepares commands but does not execute billing commands;
- route-scoped data fetching, shared-component migration, information tips, hardened forms, TanStack tables, code splitting, error boundaries and Help fixes already completed;
- auditability, keyboard access and responsive routes already verified.

Copy changes must preserve the exact meaning of workflow stages, approval decisions, role boundaries, dates, command output and audit evidence. A wording improvement must not introduce a promise, permission or system action that the product does not support.

Every implementation package must show that it changed presentation only, or explicitly stop for approval if it discovers a required behavioural change.

## 3. Design route

- **Domain/product skill:** CWS internal billing workflow and approval control.
- **Visual direction:** this plan plus `DESIGN_SYSTEM.md`, benchmarked against Work & Objectives and Codex Usage.
- **Component route:** existing React 19, Tailwind and shadcn-pattern primitives; improve and reuse rather than add a second UI framework.
- **Motion:** restrained CSS transitions for state feedback; no new animation library unless a later interaction has a demonstrated need.
- **Interface polish:** required for shell, hierarchy, controls, data density and interaction states.
- **Final verification:** repository frontend quality gate plus browser, responsive, accessibility and visual-comparison evidence.

## 4. Target design-system architecture

### 4.1 Semantic token layers

Components must consume role-based tokens rather than mode-specific colours. Use four layers:

1. **Foundation:** neutral, blue, indigo and semantic colour scales; typography, spacing, radius, shadow and motion constants.
2. **Semantic:** canvas, surface, elevated surface, inset surface, border, strong border, text, muted text, accent, accent-soft, focus, selected and semantic status roles.
3. **Component:** navigation, card, field, table, badge, dialog, tooltip and toast aliases only where semantic roles are insufficient.
4. **Theme:** light and dark values assigned to the same semantic roles.

Required roles include:

- `canvas`, `surface`, `surface-subtle`, `surface-elevated`, `surface-inverse`;
- `border`, `border-strong`, `divider`;
- `text`, `text-muted`, `text-subtle`, `text-inverse`;
- `accent`, `accent-hover`, `accent-active`, `accent-soft`, `on-accent`, `focus-ring`;
- `hover`, `active`, `selected`, `disabled`;
- `success`, `warning`, `danger`, `info` and their soft-surface/text/border variants;
- `chart-1` through `chart-6` if charts are introduced, plus gridline and tooltip roles;
- table header, row hover, row selected, sticky shadow and zebra roles;
- skeleton, overlay and command/code-surface roles.

Hard-coded theme colours in JSX or scattered component overrides are prohibited. Existing Tailwind/shadcn semantic names may remain where they map cleanly to this model.

### 4.2 Dark theme

Direction: near-black navy canvas, subtly lifted blue-black surfaces, restrained borders, cool white text and a controlled blue-indigo accent. It should feel like the recent dashboards without becoming a neon or generic developer-tool interface.

- distinguish canvas, navigation, primary surface and elevated surface without heavy shadows;
- use borders and tonal steps for hierarchy;
- reserve saturated colour for primary actions, focus, current navigation and meaningful status;
- retain readable semantic status colours on dark surfaces;
- use code/command surfaces with monospace typography and clear copy/download actions;
- avoid pure black, pure white, excessive glow and blue on every component.

### 4.3 Light theme

Direction: a pale blue-tinted application canvas with white-to-ice-blue surfaces, navy text and measured blue accents. It must be a complete theme, not a white inversion with isolated blue buttons.

- use a light blue canvas and subtly blue secondary/inset surfaces;
- keep primary work surfaces quiet enough for dense tables and forms;
- use blue-tinted borders, selected rows, navigation states and information panels consistently;
- preserve contrast and avoid low-contrast pastel text;
- keep warning, danger and success semantics independent of the blue brand direction.

### 4.4 Theme behaviour

- retain explicit Light and Dark choices in the product UI;
- initialise from the saved preference, otherwise the operating-system preference;
- apply the theme before React paint to avoid a flash of the wrong theme;
- keep the choice in the existing local preference boundary unless product requirements later require account synchronisation;
- set `color-scheme`, browser-control colours and toast/dialog overlays correctly per theme;
- include both themes in every visual, responsive and accessibility test matrix.

## 5. Shell, hierarchy and navigation

### Application shell

- align the sidebar width, canvas margins, content maximum width and vertical rhythm across routes;
- create clearer separation between product identity, role-aware navigation, contextual utilities and signed-in-user controls;
- use a compact dark navigation surface in dark mode and a controlled blue-tinted navigation surface in light mode;
- retain role-gated destinations and existing routes;
- make mobile navigation an accessible overlay/drawer with focus return, Escape support and body-scroll control;
- provide a stable page-header region so route changes do not move primary controls unpredictably.

### Page hierarchy

Use a repeatable structure:

1. breadcrumb or workflow context when needed;
2. page title and one-line operational purpose;
3. status/context metadata;
4. primary and secondary actions;
5. summary metrics or workflow progress;
6. principal work surface;
7. supporting history, guidance or audit detail.

Avoid duplicated titles, oversized hero treatments and generic cards around every block. Hierarchy should come from typography, spacing and surface role before decoration.

### Typography and spacing

- adopt one cross-product UI typography direction after verifying font delivery and licence constraints; favour Inter for family alignment unless keeping IBM Plex Sans has a documented operational reason;
- retain JetBrains Mono or an equivalent only for commands, identifiers and machine-readable values;
- define display, page title, section title, body, label, caption and code styles;
- use a consistent 4px-based spacing system with documented route, panel, form and table-density recipes;
- support comfortable default density and compact data density without globally shrinking touch targets.

## 6. Reusable component alignment

Consolidate or extend the existing primitives rather than create page-specific equivalents:

- `AppShell`, `Sidebar`, `MobileNavigation`, `PageHeader`, `Breadcrumbs`;
- `Panel`/`Card` variants for primary, secondary, inset and metric surfaces;
- `MetricCard` with label, value, context, trend/status and loading state;
- `StatusBadge`, `InlineAlert`, `EmptyState`, `ErrorState`, `Skeleton`;
- buttons, icon buttons, inputs, selects, textareas, labels, help text and field errors;
- tabs, segmented controls, dialogs, confirmation dialogs, information tips and toasts;
- `DataTable`/`SortableTable` density, sticky header, responsive overflow, selected/hover rows and pagination;
- `FilterBar`, search, active-filter chips, clear/reset action and result count;
- `CycleProgressTracker` and stage navigation with complete, active, blocked, failed and pending states;
- command/script panels with clear hierarchy, monospace output and copy/download feedback.

Each component must document and demonstrate default, hover, focus-visible, active, selected, disabled, loading, empty, validation, success, warning and error states where applicable.

## 7. Route-level UX alignment

### Sign-in and bootstrap

- align the sign-in composition with the product shell without weakening the platform-boundary message;
- preserve Entra-only behaviour and current error handling;
- apply saved/system theme before authentication bootstrap;
- provide explicit, calm loading and authentication-failure states.

### Overview

- establish a stronger operational summary with compact metrics, approvals/issues requiring attention and in-flight cycles;
- use progressive disclosure: decision-relevant status first, detail on demand;
- make “Continue” actions and cycle state visually unambiguous;
- do not introduce decorative charts without a real decision need.

### Cycles and Cycle Workspace

- make cycle identity, billing period, current stage and blocking condition persistent and easy to scan;
- improve stage navigation for complete/current/locked/error states without changing gating rules;
- separate primary task, supporting parameters and history/audit information;
- use denser script/run tables while preserving legibility, keyboard use and mobile fallback;
- make generated commands clearly distinct from editable inputs.

### Approvals and issues

- prioritise pending decisions, due context and consequences;
- distinguish request, review, approval, rejection and returned-for-correction states;
- preserve comments, audit evidence and issue classification semantics;
- make destructive or irreversible decisions explicit and accessible.

### Reporting and administration

- align filter bars, table headers, row actions, pagination and empty/loading/error states;
- support compact density on wide screens and deliberate horizontal overflow or detail cards on small screens;
- keep administration tabs and role boundaries unchanged;
- ensure forms group related fields and show inline validation, summary errors where useful and stable action placement.

### Help

- retain lazy loading and repaired assets;
- align reading width, in-page navigation, headings, callouts and downloadable content with both themes;
- avoid mixing documentation styling with operational panels.

## 8. Content design, user assistance and user guides

### 8.1 Audience and writing standard

Treat Billing and Finance as separate non-technical audiences. Users should not need to understand APIs, databases, tokens, deployment, architecture or developer terminology to complete their work.

All application copy and both role guides must:

- use the actual interface labels and verified workflow sequence;
- use short sentences, familiar words and direct action verbs;
- explain what the user is doing, why it matters, what happens next and when to stop or ask for help;
- distinguish Save, Submit, Request approval, Approve, Reject, Complete and Close wherever those actions have different consequences;
- define unavoidable billing-specific terms at first use and maintain a short glossary;
- avoid promotional language, vague reassurance, artificial enthusiasm, AI-style summaries and repetitive conclusions;
- avoid blame: explain how to recover while preserving the user's entered work;
- avoid internal implementation language and viewer-facing scaffolding such as confirmation placeholders, tenant configuration, licensing, permissions or draft-status notes.

Use the repository `humanizer` skill after the first grounded rewrite. Humanization is an editing pass, not permission to alter UI labels, workflow facts, controls, compliance meaning or business rules. Also apply the `nontechnical-user-documentation` skill to both role guides.

### 8.2 Professional no-emoji rule

No emoji or decorative Unicode pictographs may appear in:

- navigation, headings, buttons, labels, placeholders, status text or empty states;
- toasts, validation, errors, confirmations, tooltips or information tips;
- Billing and Finance user guides, PDF exports, screenshot captions or other Help content;
- user-facing seeded/demo text owned by the application.

Where a visual cue is useful, use the established icon component set with an accessible name or adjacent text. Do not replace clear words with an icon. The gate must include an automated Unicode-pictograph scan plus rendered inspection because some symbol characters can be missed by source-only checks. Existing emoji in `docs/platform/billing_user_guide.md` and `docs/platform/finance_user_guide.md` must be removed during UX-5B.

### 8.3 Product-copy inventory and rewrite method

Build a route-by-route copy inventory before rewriting. At minimum include:

- page titles and one-line purpose text;
- navigation and action labels;
- field labels, helper text and placeholders;
- status names and workflow-stage explanations;
- empty, loading, blocked and permission states;
- inline validation, error recovery and confirmation copy;
- dialogs, toasts and information tips;
- Help-page labels, role guides and PDF output.

For each entry record the role, screen/state, current copy, user need, proposed copy, consequence or next step, and verification source. Consolidate repeated copy into shared constants/components where that reduces drift without obscuring feature ownership.

Copy acceptance questions:

1. Can a first-time Billing or Finance user understand the next action?
2. Does the wording state what will happen after the action?
3. Does it help the user recover if something goes wrong?
4. Is the text true for that role and workflow state?
5. Is it concise enough for the interface, with detail moved to accessible help where appropriate?

### 8.4 Toasts, validation and confirmations

Use toasts for brief outcomes of completed actions, not as the only source of essential instructions.

- Success: name the result and, when useful, the next owner or step. Example: `Approval request sent. Finance can now review it.`
- Error: say what failed and what the user can do next. Preserve detailed technical diagnostics for logs, not the user-facing toast.
- Information: reserve for meaningful background outcomes such as a completed download; do not toast routine navigation or every field change.
- Validation: keep the message beside the relevant field and provide a summary only when a long form needs it. Do not rely on a toast that disappears.
- Consequential action: use a confirmation dialog that names the record, consequence and safe cancel option; a toast confirms only the final outcome.
- Prevent duplicate messages when the same error is already persistent on the page. Ensure announcements are accessible and do not repeatedly interrupt assistive-technology users.

### 8.5 Information tips and contextual guidance

Provide simple information tips where a label, status, calculation, approval consequence or billing term is likely to be unfamiliar. Do not place a tooltip beside every field.

- essential instructions must remain visible as helper text or in the guide, never hover-only;
- each tip should answer one likely question in one or two short paragraphs;
- use plain examples where they reduce risk, but do not invent customer or financial data;
- support hover, keyboard focus and click/tap; Escape closes the tip and focus remains predictable;
- give the trigger an accessible name and keep the popover readable in both themes and at mobile widths;
- explain disabled or blocked actions close to the action, including what must happen first;
- use consistent terms between the tip, toast, page copy and user guide.

### 8.6 Billing and Finance user guides

Maintain separate role-specific guides rather than one long mixed guide.

**Billing guide structure**

1. Purpose and what Billing is responsible for.
2. Before starting a monthly cycle.
3. Sign in, navigation and theme choice.
4. Create or select the correct billing cycle.
5. Generate test scripts and record test runs.
6. Check results and request Finance approval to move to live.
7. Respond to a rejection or issue.
8. Generate live scripts and record live runs.
9. Request post-live approval.
10. Prepare notifications and close the cycle.
11. Common situations, do/do not guidance, final checklist and escalation.

**Finance guide structure**

1. Purpose and what Finance is responsible for.
2. Before reviewing a request.
3. Find and open the correct approval.
4. Review test evidence before Move to live.
5. Approve or reject, including how to write useful comments.
6. Review live evidence before Move to notifications.
7. Understand what happens after each decision.
8. Common situations, do/do not guidance, final checklist and escalation.

Break each task into short numbered sections, normally five to seven steps or fewer. Start with the outcome, then give the steps, a brief `Check before continuing` list and `What happens next`. Use callouts only for meaningful warnings, permissions or irreversible consequences. Provide an in-page contents/navigation pattern and progressive disclosure so users do not face one uninterrupted document.

Update screenshots after the visual redesign rather than carrying forward obsolete images. Each retained screenshot needs a short caption explaining what to notice. Do not overload the guide with every screen. Verify both on-screen Help and exported PDF for headings, page breaks, image sizing, contrast and missing assets.

## 9. Interaction, responsive and accessibility requirements

### Interaction states

- visible hover only where an element is actionable;
- persistent selected/current indicators that do not rely on colour alone;
- `:focus-visible` rings with at least 3:1 contrast against adjacent colours;
- loading states that preserve layout and prevent duplicate submissions;
- error states that explain recovery without losing entered data;
- confirmation only for consequential actions; undo where the workflow permits it;
- status changes announced through appropriate live regions without duplicative screen-reader output.

### Responsive behaviour

Verify at minimum 375, 768, 1024 and 1440 CSS pixels in both themes.

- sidebar becomes a keyboard-safe mobile navigation drawer;
- page headers wrap actions without reordering their meaning;
- forms move from multi-column to single-column deliberately;
- tables retain data relationships through horizontal scrolling, sticky key columns or a tested row-detail pattern;
- dialogs fit the viewport and keep actions reachable;
- stage navigation remains understandable without clipped labels;
- touch targets are at least 44px through mobile and tablet widths; dense desktop controls may reduce to 40px at the `lg` breakpoint and above.

### Accessibility

- WCAG 2.2 AA contrast for text and meaningful UI states in both themes;
- keyboard access and logical focus order on every changed route;
- focus trap/return for drawers and dialogs;
- labels, descriptions, validation association and accessible names for icon-only controls;
- status and selected states conveyed through text/icon/semantics as well as colour;
- 200% zoom and browser text enlargement without loss of task completion;
- `prefers-reduced-motion` removes nonessential transition and movement;
- no focus removal, tooltip-only essential content or colour-only table meaning.

## 10. Phased implementation packages

Packages are deliberately bounded so an interrupted Claude or Codex window does not leave an unreviewable redesign. Package IDs use `UX-*` to avoid collision with the existing numbered RG-01 package history.

### UX-0 — Integration base and visual contract

**Status:** Design direction approved on 2026-09-09. Integration-base reconciliation remains pending and does not constitute business or release acceptance.

**Owner:** Hermes/Codex; no feature implementation.
**Purpose:** prevent the redesign from starting on the wrong branch or from silently discarding completed work.

- reconcile the currently checked-out branch with the completed Entra-only branch and any unintegrated feature work;
- record branch, HEAD and pre-existing dirty files;
- confirm protected routes, role matrix, workflow states and accepted fixes;
- capture baseline screenshots for representative routes/states in the current themes;
- create a route/state/theme viewport matrix and a compact visual acceptance checklist;
- decide whether the implementation branch is created from the approved integration commit.

**Exit:** Gregory approves the integration base; no application behaviour is changed.

### UX-1 — Theme and token foundation

**Status:** Implemented and validated locally. Package 12-first integration, combined regression, staging Entra proof, operational approval, and Finance/Billing acceptance remain pending.

**Best executor:** one Headroom-wrapped Claude Code session.
**Primary files:** `frontend/src/App.css`, theme bootstrap/provider files, Tailwind configuration, shared UI primitives.

- implement the semantic token layers and complete dark/light palettes;
- replace scattered mode-specific overrides with semantic roles;
- implement saved/system initialisation without theme flash;
- align typography, spacing, radius, border, elevation and restrained motion constants;
- add an internal development-only theme/state review surface if it can be excluded from production navigation.

**Checks:** lint, build, theme persistence, no-flash reload, contrast sampling, reduced motion, primitive-state browser review in both themes.

### UX-2 — Shell, navigation and page-header system

**Best executor:** one Headroom-wrapped Claude Code session.
**Primary files:** `MainLayout.jsx`, `Sidebar.jsx`, navigation configuration, new shared shell/header/breadcrumb primitives, `LoginPage.jsx` only where presentation changes.

- align desktop shell and content geometry;
- implement accessible mobile navigation;
- introduce consistent page headers, breadcrumbs/context, action placement and user/theme controls;
- align sign-in and bootstrap surfaces while preserving Entra-only behaviour.

**Checks:** role-gated navigation, deep links, theme switching, keyboard/focus, 375/768/1024/1440 layouts, auth contract unchanged.

### UX-3 — Core components and operational states

**Best executor:** one Headroom-wrapped Claude Code session.
**Primary files:** `components/ui/*`, `components/billing/*` and minimal consumers required to prove the API.

- align panels/cards, metrics, badges, alerts, form controls, dialogs, tooltips, toasts, skeletons and empty/error states;
- align DataTable/SortableTable and FilterBar behaviour/density;
- complete CycleProgressTracker visual and semantic states;
- establish shared copy patterns for outcome toasts, validation, confirmations, blocked-state explanations and information tips;
- remove remaining presentation-only bridge duplication after verified migration.

**Checks:** component-state matrix in both themes, keyboard/dialog behaviour, table overflow, no API or domain-state change.

### UX-4 — Operate and decide journeys

**Best executor:** one or two Headroom-wrapped Claude Code sessions, split at the boundary below if the diff is broad.

**UX-4A:** Overview, Cycles list and Cycle Workspace.
**UX-4B:** Approvals Inbox, issue dialogs/panels and notifications.

- apply the target hierarchy, density and workflow-state treatment;
- preserve every transition, gate, field, action, role and API call;
- improve blocked/current/completed/failed explanations and action priority;
- rewrite route-level headings, instructions, field help, empty/error text, confirmations, toasts and information tips using the Section 8 content standard;
- verify realistic populated, empty, loading, error and permission states.

**Checks:** focused frontend checks plus end-to-end monthly-cycle regression through the available disposable stack; both themes and all four viewports on changed routes.

### UX-5 — Reporting, administration, product copy and Help

**Best executor:** two bounded Headroom-wrapped Claude Code sessions.

**UX-5A — Reporting, administration and application-wide copy audit**

- align reporting filters, tables, pagination and issue states;
- align administration tabs and forms without permission changes;
- complete the route-by-route copy inventory and close copy gaps left by UX-4;
- standardise toasts, validation, confirmations and information tips across all roles;
- remove emoji from all user-facing application copy;
- verify dense and long-content cases.

**UX-5B — Role guides and Help experience**

- rewrite `docs/platform/billing_user_guide.md` and `docs/platform/finance_user_guide.md` using the grounded non-technical structure in Section 8;
- run the `humanizer` editing pass while preserving exact verified labels and process meaning;
- remove all emoji and decorative pictographs from the guides and generated output;
- break guidance into short task sections with checks, next steps, recovery advice and escalation points;
- align Help reading width, contents/navigation, headings, callouts and screenshot captions while retaining lazy loading and PDF behaviour;
- replace or recapture screenshots after the new visual system is stable and verify that each image teaches a user action.

**Checks:** populated reporting fixture, sort/filter/pagination, form validation, role restrictions, copy-inventory completion, automated no-emoji scan, Billing and Finance walkthroughs against actual UI labels, Help/PDF chunk loading and rendered PDF inspection, both themes and representative responsive widths.

### UX-6 — Independent quality gate and remediation

**Owner:** Hermes/Codex for independent review; Claude only for bounded remediation when needed.

- run frontend lint/build and relevant backend regression tests;
- execute the complete route × role × state × theme × viewport browser matrix;
- compare final screenshots side by side with RG-01 baseline and the two reference dashboards;
- inspect console errors, failed requests, keyboard/focus, contrast, zoom and reduced motion;
- verify no workflow, auth, role, API, schema or audit regression;
- verify the full copy inventory, toast/validation/info-tip rules, role-guide walkthroughs and zero user-facing emoji;
- remove temporary review routes/artifacts not intended for production;
- document exceptions honestly and obtain Gregory's visual acceptance.

**Exit:** rendered evidence supports the product-family alignment claim in both themes.

### UX-7 — Integration, pilot and release gates

This package includes human and operational work that an agent cannot declare complete.

1. review and integrate the approved implementation branch;
2. rerun the independent technical gate on the integrated commit;
3. conduct existing Package 4: the controlled Finance/Billing pilot using real roles and a representative monthly cycle;
4. confirm issue-classification vocabulary and routine-use fit;
5. obtain business and visual acceptance;
6. authorise and execute deployment through the existing controlled process;
7. perform post-deployment smoke checks, monitoring and handover;
8. record rollback evidence and remaining backlog.

RG-01 remains technically ready or pilot-ready until these external gates are evidenced; visual implementation alone does not complete the objective.

## 11. Required evidence matrix

At minimum, capture these routes/surfaces in both Light and Dark at desktop and mobile; use additional tablet evidence for layouts that materially change:

- authentication/bootstrap and authentication error;
- Overview for Billing, Finance and System Admin;
- Cycles list: populated, empty and loading;
- Cycle Workspace at each reachable stage, including blocked and failed states;
- Approvals Inbox: pending, history, decision and empty;
- issue entry, activity and reporting: validation, populated table, filtering and pagination;
- Administration tabs and consequential-action dialog;
- Help and PDF/download interaction;
- route error boundary, toast, dialog, tooltip and mobile navigation;
- long labels, long identifiers and high-row-count tables.

Content evidence must also include:

- completed copy inventory with Billing and Finance coverage;
- paired examples of improved page guidance, blocked-state explanation, success/error toast and consequential confirmation;
- keyboard, touch and screen-reader checks for representative information tips;
- role-by-role completion of the guide's main workflow against the live application;
- rendered Help and exported PDF review with updated screenshots;
- automated and visual confirmation that user-facing application and guide content contains no emoji.

Do not approve a package from isolated component screenshots when its route-level workflow changed visually.

## 12. Acceptance criteria

The alignment is complete only when all are true:

- Light and Dark are complete themes using the same semantic component contracts.
- Dark has the near-black/navy, restrained-border, compact professional character of the recent dashboards.
- Light consistently uses a controlled light-blue canvas/surface system.
- The shell, typography, hierarchy, spacing and controls visibly belong to the same product family as the references.
- All protected workflows and completed functional improvements remain present and regression-verified.
- Every changed component covers applicable interaction and system states.
- Billing and Finance copy is plain, natural, role-correct and explicit about consequences and next steps.
- Toasts, validation, confirmations and information tips follow one verified content pattern and never carry essential instructions only in transient or hover-only UI.
- The two role guides are broken into short task-based sections, match actual interface labels and include checks, recovery guidance and what happens next.
- No emoji or decorative pictographs remain in user-facing application copy, guides, Help output or exported PDFs.
- No hard-coded theme colours remain in feature JSX except documented data-driven exceptions.
- Representative routes pass keyboard, contrast, zoom, reduced-motion and responsive checks.
- Lint and production build pass; relevant backend and browser regression checks pass.
- Console/network review has no unexplained errors.
- Final rendered comparisons are stored with a concise acceptance report.
- Gregory accepts the visual direction before integration/deployment.

## 13. Token-efficient multi-session operating model

Use the repository plan as the source of truth; do not paste the whole plan into each session.

### Allocation

- **Hermes/Codex:** UX-0, scope control, branch reconciliation, test orchestration, evidence reduction, independent UX-6 review and final handover. These are structured and verification-heavy tasks.
- **Headroom-wrapped Claude Code:** UX-1 through UX-5 implementation. UX-5 is split into 5A and 5B so interface work and the detailed role-guide rewrite do not compete for one context window. These packages benefit most from Claude's frontend and content judgement and can be bounded by route/component ownership.
- **Gregory:** integration-base decision, visual checkpoint after UX-2/UX-3, final visual acceptance, pilot and deployment authority.

### Quota discipline

- run one package per isolated Claude session;
- start Claude only when the provider-authoritative current window is below the repository's 65% safety threshold;
- stop before broadening scope or crossing a clean package boundary;
- do not spend a second model on parallel implementation of the same package;
- use one independent review after a coherent group, not full duplicate reviews after every small edit;
- persist test output, screenshots and a <=600-word handover so the next session reads evidence instead of rediscovering the repository;
- use Codex for mechanical checks and targeted remediation only when this is cheaper than opening another design-heavy Claude session.

### Session prompt template

Run from the repository root and replace `<PACKAGE>` with one package ID:

```text
Implement only <PACKAGE> from docs/RG01_UI_UX_DESIGN_SYSTEM_ALIGNMENT_PLAN.md.

Read, in order: AGENTS.md; CLAUDE.md (or OPENCODE.md for your agent); .opencode/skills/cws-billing-platform-change/SKILL.md; docs/AGENT_DESIGN_SKILLS.md; docs/RG01_UI_UX_DESIGN_SYSTEM_ALIGNMENT_PLAN.md; and the current RG-01 tracker/handover relevant to this package. For any copy, toast, information-tip or user-guide work, also load the Hermes `humanizer` and `nontechnical-user-documentation` skills. Use CodeGraph first; if unavailable or stale, state that before targeted file reads.

Before editing, report the current branch/HEAD, visible dirty files, package boundary, protected behaviour, design route and intended checks. Preserve unrelated dirty work. Do not change auth, API contracts, roles, workflow gates, schema, deployment or production configuration. Do not commit, push, merge or deploy.

Implement the smallest coherent package. Ground every wording change in actual UI behaviour and labels; use the humanizer only after factual drafting, remove all user-facing emoji, and verify transient guidance is not the sole source of essential information. Exercise the changed UI in a browser in Light and Dark at the required widths and states. Run the plan's checks and the repository quality gate. Record actual results, screenshots/artifacts, files changed, behavioural impact, exceptions and a <=600-word continuation handover. Update the RG-01 tracker only with verified facts. Stop rather than silently broadening scope.
```

### Independent review prompt

```text
Independently verify UX-6 in docs/RG01_UI_UX_DESIGN_SYSTEM_ALIGNMENT_PLAN.md. Do not assume prior handovers are correct. Re-establish branch/HEAD/dirty boundary, inspect the actual diff, run the stated automated and browser matrices, compare stored final screens with the RG-01 baseline plus Work & Objectives and Codex Usage references, and test both themes. Verify the copy inventory, both role guides against live labels and workflows, toast/validation/info-tip behaviour, Help/PDF rendering and the zero-emoji rule. Focus on regressions, inconsistent tokens/components, missing states, accessibility, responsive failures and protected billing/auth behaviour. Make no broad redesign. Return evidence-ranked findings and only apply bounded fixes explicitly authorised for this review.
```

## 14. Immediate next step

Integrate Package 12 commit `30bd469` before UX-1. Then integrate UX-1 implementation commit `eb6a0fcda0e1c1dd16ce9fab6f50fbd41846a3c9` and its validated design-alignment follow-ups, record the resulting combined release-candidate SHA, and run combined regression. Staging Entra validation, rollback evidence, operational approval, Finance/Billing acceptance, deployment authorization, and production verification remain separate gates.
