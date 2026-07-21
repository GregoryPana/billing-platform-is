# First LLM Agent Prompt — Revenue Protection Issue Control

Use this prompt with Claude Code or OpenCode **as the first implementation-preparation agent**. It deliberately performs only the prerequisite readiness phase; it must not implement the issue feature yet.

```text
Use the CWS Billing Platform change skill.

You are preparing a production-sensitive CWS internal application for a later Revenue Protection Issue Control implementation. Work in this repository only:

/mnt/c/Users/gpanagary/.gemini/antigravity/scratch/billing

This is a READINESS / PRE-FLIGHT task. Do not implement the issue-control feature, modify application business logic, modify database schema, deploy, restart services, change GitHub Actions, change Entra configuration, inspect `.env` values, change secrets, push, commit, force-push, or clean/revert pre-existing work.

Read in this exact order:
1. AGENTS.md
2. CLAUDE.md or OPENCODE.md
3. .opencode/skills/cws-billing-platform-change/SKILL.md
4. .opencode/skills/hermes-update-pack/SKILL.md
5. docs/IMPLEMENTATION_READINESS_PACK.md
6. docs/FINANCE_ISSUE_CONTROL_DESIGN.md
7. docs/plans/2026-07-21-revenue-protection-issue-control.md
8. docs/entra-id-integration-plan.md
9. docs/AGENT_DESIGN_SKILLS.md

Use CodeGraph first for repository orientation and impact analysis. If it is unavailable, stale, or insufficient, state that before direct file discovery.

Business contract that later implementation must preserve:
- Only target roles: billing_user, finance_user, system_admin. Viewer is to be retired, not retained.
- Billing can log rare execution issues against a specific run and read Finance findings.
- Finance logs multiple cycle-level test-review issues after Test runs are complete and before Move to Live approval.
- Finance test-review issue classifications: Loyalty Points; Bill with Zero or Negative Value; Incorrect Product Setup; Other (detail required).
- Finance owns Finance issue comments, completion, raised-in-error and reopening. Billing is read-only for those findings.
- Finance issue states are open/completed. Completion outcome is resolved or raised_in_error. A comment is mandatory only for raised_in_error.
- A Finance test-review issue may be reopened only before Move to Live approval, with a mandatory comment.
- Any open Finance test-review issue blocks Move to Live approval at the BACKEND and UI layers.
- Post-live observations are Finance/Admin-only and never block completion.
- There is no assignment, due date, SLA, attachment, financial estimate, ticket queue or cross-cycle backlog in MVP.
- Cerillion is a black-box operational system; this platform must not execute billing commands automatically.

Perform only these tasks:

A. Baseline safety assessment
- Report current branch, HEAD SHA, upstream relation, and all visible dirty/untracked paths.
- Separate the pre-existing dirty work from any new work. Do not modify it.
- Identify whether the currently visible Entra/auth work is committed, testable and isolated enough to be a base for the feature. Do not judge it complete merely because files exist.

B. CodeGraph-first impact map
- Identify the symbols/files that currently enforce: role authorization; current actor resolution; approval decision; cycle status progression; script-run readiness; schema/startup migration behaviour; frontend ApprovalStage; frontend ScriptsRunsStage; app data fetching; CI/deployment.
- Produce a concise caller/callee/impact summary with exact paths.

C. Readiness-gate evidence
- Determine whether a clean branch/worktree is available or whether the existing dirty worktree prevents a reliable feature diff.
- Determine whether an Alembic baseline exists and whether a tracked backend test harness exists.
- Inspect CI configuration without editing it and identify current test/build/deploy/proof gaps.
- Inspect the Entra plan/current auth code without reading `.env` values. Identify only role-model mismatches or rollout blockers.

D. Write one read-only readiness report
Create exactly one new file:
- docs/IMPLEMENTATION_PRE_FLIGHT_REPORT.md

It must contain:
1. Timestamp, branch, HEAD SHA and repo state.
2. Files/symbols inspected through CodeGraph and direct reads.
3. Gate A result: Entra/base-worktree readiness (PASS / BLOCKED with evidence).
4. Gate B result: migration/deployment readiness (PASS / BLOCKED with evidence).
5. Gate C result: test harness readiness (PASS / BLOCKED with evidence).
6. Exact smallest next safe task, with paths and test commands.
7. A strict GO / NO-GO decision for beginning the issue-control feature.
8. No secrets, no guessed production state, no implementation code.

Run only safe read-only checks required for the report. Do not run a deployment, database migration, destructive database command or production service operation.

Before ending:
- append a compact entry to .opencode/hermes-pending-updates.md;
- report changed files, existing dirty files not touched, commands/checks run, checks unavailable, deployment/auth/data impact, blockers, and the exact next gate;
- do not commit or push.
```

## What to send after the first agent finishes

Send Hermes/OpenCode/Claude’s report and its exact final summary. Do not start Phase 1 automatically if the report says `BLOCKED`.

If all three readiness gates pass, use the plan’s **Task 1: Establish migration and deploy safety before schema work** as the next bounded agent task, with a fresh implementation agent and independent spec/quality review.
