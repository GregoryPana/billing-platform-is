# OpenCode Operating Rules — Billing Collaboration Platform

This file is the OpenCode adapter for the repo-local agent harness. Read `AGENTS.md` first; it is the cross-agent source of truth.

## Required reading order

1. `AGENTS.md`
2. `.opencode/skills/cws-billing-platform-change/SKILL.md` for project changes
3. `.opencode/skills/hermes-update-pack/SKILL.md` for handoffs
4. `docs/entra-id-integration-plan.md` before auth/Entra work
5. `docs/AGENT_DESIGN_SKILLS.md` before substantial frontend/UI work

## Operating rules

- Use CodeGraph first for navigation and impact analysis.
- Preserve the existing dirty worktree and never stage unrelated changes.
- Do not deploy, alter CI/CD, change production config, run destructive database commands, force-push, or inspect secret values without explicit Gregory approval.
- Treat Entra/auth/session changes as security-sensitive.
- For implemented UI, run available build/lint/type checks and provide browser/responsive/console verification before claiming completion.

## Hermes Update Pack parity

OpenCode must follow this Hermes Update Pack cadence:

1. After meaningful work, append a compact 3–8 line entry to `.opencode/hermes-pending-updates.md`.
2. Ask exactly: `Hermes pending log: N entries since <oldest date>. Generate the consolidated Hermes Update Pack now?`
3. Generate the full pack only when Gregory says yes or runs `/hermes-handoff`.
4. Use canonical project name: `Billing Collaboration Platform`.
5. Never include secrets; redact sensitive values as `[REDACTED]`.

When producing the pack, include branch/status, latest commit/push status, changed files, pre-existing dirty files not touched, commands/tests, deployment impact, auth/security/data impact, docs impact, decisions, risks, and suggested Hermes vault updates.
