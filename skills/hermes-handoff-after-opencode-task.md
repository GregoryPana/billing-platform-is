---
name: hermes-update-pack
description: Credit-efficient Hermes handoff. After meaningful work, append a compact entry to the pending-updates log and ask Gregory whether to flush; produce the full consolidated Hermes Update Pack only when Gregory says yes or runs /hermes-handoff.
---

# Hermes Update Pack

Canonical vault project name: **Billing Collaboration Platform**. Always use this name in log entries and packs.

## Update cadence — pending log first (changed 2026-07-06; replaces "full pack after every change")

Full update packs are expensive. Do **not** produce a full Hermes Update Pack after every change. Instead:

1. **After each meaningful change or investigation**, append one compact entry (3-8 lines, no more) to `.opencode/hermes-pending-updates.md` in this repo (create the file with a `# Hermes Pending Updates` heading if missing):

   ```markdown
   ## <YYYY-MM-DD HH:MM> — <one-line task summary>
   - branch/commit: <branch> @ <short SHA> (pushed to origin: yes/no)
   - files: <paths, comma-separated>
   - verification: <tests/build run and result, or "not run — <why>">
   - flags: <deployment-needed | auth/security/data impact | decision made | new risk | none>
   ```

2. **Then ask Gregory exactly one line**: `Hermes pending log: N entries since <oldest date>. Generate the consolidated Hermes Update Pack now?` Do not print a pack unless he says yes.
3. **When Gregory says yes** (or runs `/hermes-handoff`): read ALL unflushed pending entries plus current repo state, and produce **one consolidated Hermes Update Pack** (format below) covering everything since the last flush. Consolidate per-file net effect rather than repeating per-session narration; keep every decision, risk, and verification gap itemized.
4. **After producing the pack**, move the flushed entries under a `## Flushed <YYYY-MM-DD>` heading at the bottom of the pending log (do not delete them) and continue logging new work above it.
5. **Skip the queue** and offer a full pack immediately only for major single events: production deployment, auth/schema/migration changes, destructive operations, or a security issue.
6. The pending log is repo-local working state for Hermes handoff. Never write secret values into it.

## When a full (flushed) pack is required

Whatever accumulated in the pending log since the last flush, covering work that:
- changes code, tests, docs, config, deployment, CI/CD, database/schema, auth, permissions, roles, architecture, or runtime topology;
- investigates the repo and discovers useful project knowledge;
- confirms, rejects, creates, or changes decisions, risks, assumptions, blockers, or operating rules.

## Hard rules

- Do not include secret values. Redact secrets as `[REDACTED]`.
- Do not claim Hermes updated the vault. Hermes updates the vault only after Gregory sends the pack to Hermes.
- Be explicit about deployment, auth/security, data/schema, and docs impact even when the answer is "none".
- Separate files you changed from pre-existing dirty/untracked work.
- If tests were not run, say exactly why and list the verification gap.

## Pack format

```markdown
Hermes Update Pack — <Project Name>

Session metadata
- Agent: OpenCode
- Date range covered: <YYYY-MM-DD .. YYYY-MM-DD> (consolidated flush of N pending entries)
- Branch: <branch>
- Latest commit SHA: <short SHA> — pushed to origin: yes/no (state push blockers explicitly; committed is not pushed)
- Working directory: <absolute path>
- Task summary: <one sentence per consolidated task>

Files changed
- <path>: <what changed and why>

Pre-existing dirty/untracked files not touched
- <path or none>

Commands run
- <command> — <result>

Tests / verification
- test/check: <command or manual check>
- result: passed/failed/not run
- failures: <none or details>
- coverage: <if applicable>
- verification gaps: <none or details>

Implementation summary
- <bullets>

Phase / roadmap impact
- <phase impact>
- <later phase impact>

Deployment impact
- deployment performed: yes/no
- deployment needed: yes/no/unknown
- staging impact:
- production impact:
- CI/CD impact:
- rollback consideration:

Auth / security / data impact
- auth/session impact:
- role/access impact:
- database/schema impact:
- migration impact:
- data safety impact:
- secret/env impact:
- security risks:

Documentation / handover impact
- docs changed:
- EXIT/handover impact:
- what Hermes should record:

Decisions
- Confirmed:
- New decisions required:

Risks / open questions
- new risks:
- resolved risks:
- changed risks:
- open questions:
- blockers:

Suggested Hermes vault updates
- project overview:
- technical architecture:
- deployment/CI-CD:
- risks/open questions:
- decision log:
- process/skills:

Next recommended task
- <one or two options>
```
