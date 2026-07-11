# Hermes Update Pack — Billing Collaboration Platform

Produce the same consolidated Hermes Update Pack used by OpenCode for this repository.

## Rules

- Work read-only unless Gregory explicitly asks for edits.
- Use canonical project name: `Billing Collaboration Platform`.
- Read `AGENTS.md`, `CLAUDE.md`, `OPENCODE.md`, and `.opencode/skills/hermes-update-pack/SKILL.md` first.
- Read all unflushed entries in `.opencode/hermes-pending-updates.md` if present.
- Include current branch, latest commit, push status, and pre-existing dirty files not touched.
- Do not include secrets, tokens, cookies, passwords, connection strings, `.env` values, or private keys. Redact as `[REDACTED]`.

## Output sections

- Session metadata
- Files changed or inspected
- Pre-existing dirty/untracked files not touched
- Commands run
- Tests / verification
- Implementation summary
- Deployment impact
- Auth / security / data impact
- Documentation / handover impact
- Decisions
- Risks / open questions
- Suggested Hermes vault updates
- Next recommended task
