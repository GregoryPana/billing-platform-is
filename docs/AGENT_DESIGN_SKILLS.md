# Agent Design Skills — CWS Billing Platform

OpenCode and Claude implement this project. Hermes may orchestrate and select a design route, but the coding agent working in the repository must read and apply the project sources below.

## Policy and route

Do not load every design skill. Before substantial frontend/UI work, record:

```text
Design route
- Domain/product skill: CWS internal billing workflow
- Visual direction: DESIGN_SYSTEM.md
- Component/implementation skill: project stack / shadcn where applicable
- Motion: CSS/restraint | Emil/GSAP required | not relevant
- Interface polish: required | optional | not relevant — reason
- Final verification: frontend design quality gate
```

## Required sources and default bundle

1. `AGENTS.md`, the current agent adapter, and task-specific project skills.
2. `DESIGN_SYSTEM.md` as the authoritative project design source.
3. **CWS SaaS Product UI** for workflow clarity, roles, forms, tables, dashboards, states, approvals, and operational feedback.
4. **shadcn/ui Components** when the current React/Tailwind/component stack uses those conventions.
5. **Impeccable Frontend Craft** for static/structural implementation craft and evidence-based polish.
6. **Frontend Design Quality Gate** before implemented UI is accepted.

Optional: **Emil Kowalski Motion Polish** for drawers, dialogs, toasts, interruption/reversal and restrained state motion; visual-style exploration, GSAP, and mobile-specific skills only when justified.

## Agent-agnostic source resolution

Central roots:

```text
WSL:     /mnt/c/Users/gpanagary/central-agent-skills
Windows: C:\Users\gpanagary\central-agent-skills
```

| Capability | Project minimum | Central agent skill | Hermes-local full source |
|---|---|---|---|
| Billing workflow/design | `DESIGN_SYSTEM.md` and project rules | No complete central equivalent | `/home/gpanagary/.hermes/skills/creative/cws-saas-product-ui/SKILL.md` |
| Component implementation | Current project components/tokens | No central equivalent | `/home/gpanagary/.hermes/skills/software-development/shadcn-ui-components/SKILL.md` when applicable |
| Static interface craft | This file and `DESIGN_SYSTEM.md` | `skills/design/impeccable-frontend-craft/SKILL.md` | `/home/gpanagary/.hermes/skills/creative/interface-polish-engineering/SKILL.md` |
| Motion | Restrained operational-feedback rule | `skills/design/emil-kowalski-motion-polish/SKILL.md` | `/home/gpanagary/.hermes/skills/software-development/gsap-web-animation/SKILL.md` only for justified complex motion |
| Final QA | Completion standard below | Impeccable supplies craft review only | `/home/gpanagary/.hermes/skills/software-development/frontend-design-quality-gate/SKILL.md` |

If a named central or Hermes source is inaccessible, apply the embedded project minimum, report the missing source, and do not claim its full checklist was performed.

## Completion standard

Before claiming frontend/UI work complete:

- run applicable lint, typecheck, tests, and build;
- inspect changed routes/components in a browser;
- check console and failed network requests;
- check responsive behavior and relevant workflow states;
- verify focus, labels, keyboard use, contrast, and reduced motion;
- verify empty/loading/error/success/disabled/permission states relevant to the change;
- record the interface-polish decision and inspected evidence;
- report what was verified, what was not, and any runtime/auth/data/deployment impact.
