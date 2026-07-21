# Agent Design Skills

This project is implemented by Claude/OpenCode inside the repo, while Hermes owns design-skill routing and high-level orchestration.

## Policy

Do **not** load every design skill for every task. For routine development, use the default project bundle below. Ask Hermes for a specific bundle when the task involves visual direction, animation, mobile-first design, or frontend QA.

## Default bundle for this CWS internal app

Use for normal dashboards, forms, admin screens, workflow pages, reports, records, and settings:

1. **CWS SaaS Product UI** — workflow-first internal SaaS design, app shell, forms, tables, dashboards, roles, states.
2. **shadcn/ui Components** — React/Tailwind/shadcn component composition, semantic tokens, cards, tables, dialogs, sheets, forms.
3. **Frontend Design Quality Gate** — build/lint/browser/responsive/console checks before claiming UI complete.

Optional only when needed:

- **Web Design Style Library** — visual direction, reference family, or token exploration.
- **GSAP Web Animation** — motion tokens, animation implementation, ScrollTrigger/timelines, reduced-motion/performance.
- **Mobile App UI Design** — mobile-first screens, onboarding, thumb-zone workflows, bottom-sheet patterns.

## Project design source of truth

Before substantial UI work, read whichever exists:

- `DESIGN.md`
- `DESIGN_SYSTEM.md`
- `docs/DESIGN.md`
- `docs/DESIGN_SYSTEM.md`
- this file

If no design-system file exists, propose one before large frontend changes.

## Hermes skill files available locally

When you need the full guidance, read only the relevant files:

```text
/home/gpanagary/.hermes/skills/creative/design-skill-stack/SKILL.md
/home/gpanagary/.hermes/skills/creative/cws-saas-product-ui/SKILL.md
/home/gpanagary/.hermes/skills/software-development/shadcn-ui-components/SKILL.md
/home/gpanagary/.hermes/skills/software-development/frontend-design-quality-gate/SKILL.md
/home/gpanagary/.hermes/skills/creative/web-design-style-library/SKILL.md
/home/gpanagary/.hermes/skills/software-development/gsap-web-animation/SKILL.md
/home/gpanagary/.hermes/skills/creative/mobile-app-ui-design/SKILL.md
```

## Completion standard for UI work

Before saying frontend/UI work is complete:

- run available lint/typecheck/build commands;
- inspect key routes/components in browser where possible;
- check console errors;
- check mobile/responsive behavior for user-facing screens;
- confirm empty/loading/error/success states where relevant;
- summarize what was verified and what remains unverified.
