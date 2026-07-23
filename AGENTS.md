# Agent Operating Guide — Billing Collaboration Platform

This repository is the CWS Billing Collaboration Platform. It is a CWS internal SaaS-style application using FastAPI, React/Vite, PostgreSQL, Entra ID, and project-local agent tooling.

## Required reading order

1. `AGENTS.md` — this cross-agent operating contract.
2. `OPENCODE.md` or `CLAUDE.md` — tool-specific adapter for the current agent.
3. `.opencode/skills/cws-billing-platform-change/SKILL.md` when making project changes.
4. `.opencode/skills/hermes-update-pack/SKILL.md` when logging or flushing a Hermes Update Pack.
5. `docs/entra-id-integration-plan.md` before auth/Entra work.
6. `docs/AGENT_DESIGN_SKILLS.md` before substantial frontend/UI work.

## CodeGraph-first navigation

Use CodeGraph before grep/read discovery for repo orientation, symbol lookup, route tracing, caller/callee checks, and impact analysis.

```bash
codegraph status
codegraph query <term>
codegraph files
codegraph callers <symbol>
codegraph callees <symbol>
codegraph impact <symbol>
```

If CodeGraph is unavailable, stale, or insufficient, say why before falling back to direct reads/search.

## Safety rules

- Preserve the existing dirty worktree. Do not stage or commit unrelated files.
- Do not inspect or print `.env` values, tokens, cookies, passwords, private keys, or connection strings.
- Do not deploy, change CI/CD, force-push, rewrite history, run destructive database commands, or change production config without Gregory's explicit approval.
- Treat Entra/auth/session changes as security-sensitive.
- Keep changes narrow and verify with the most relevant tests/builds available.

## Validation expectations

Before claiming completion, report:

- files changed or inspected;
- commands/tests/checks run and actual results;
- checks not run and why;
- deployment impact;
- auth/security/data impact;
- docs/handover impact;
- risks and next actions.

## Hermes Update Pack cadence

After meaningful work, append a compact entry to `.opencode/hermes-pending-updates.md`, then ask Gregory whether to generate the consolidated Hermes Update Pack. Only produce the full pack when he says yes or runs `/hermes-handoff`; skip the queue only for production deployment, auth/schema, destructive, or security events.

Use canonical project name: **Billing Collaboration Platform**.
