---
name: cws-billing-platform-change
description: Project-specific OpenCode operating skill for Billing Collaboration Platform changes.
---

# Billing Collaboration Platform Change Skill

Invoke this skill with: **"Use the CWS Billing Platform change skill"**.

## Project purpose

Internal IS/billing coordination platform for monthly billing operations: cycle coordination, backend command generation/preparation, run tracking, finance approval gates, notification preparation, and audit history. It is not a billing engine and must not execute Cerillion/billing commands automatically.

## Mandatory operating rules

- Use branch/PR discipline; recheck current branch before work. Imported active branch was feature/entra-id-auth.
- Treat Entra ID auth, deployment, app settings, GitHub secrets, and production runners as high-risk controlled areas.
- Do not read/write real env files, deploy, restart production services, change GitHub secrets, change Entra app settings, push to main, force-push, or overwrite dirty user work without Gregory approval.
- Use CodeGraph first for symbol lookup, route tracing, and impact analysis when available; verify untracked auth files directly when needed, without secrets.
- Cerillion remains a black-box operational dependency to coordinate around, not automate into, unless Gregory explicitly approves an exception.

## Start-of-task checklist

1. Confirm current branch and visible dirty/untracked files.
2. Identify whether the request touches live operations, auth/security, data/schema, deployment, CI/CD, or secrets.
3. If CodeGraph MCP is available, use CodeGraph first for repo orientation, symbol lookup, route tracing, or impact analysis before broad file reading.
4. Preserve pre-existing dirty work. Do not clean, commit, revert, or overwrite files unless Gregory explicitly asked for that exact action.
5. Run the smallest useful verification first, then the broader verification available for this repo.

## End-of-task requirement

Before ending, use the **hermes-update-pack** skill and produce the Hermes Update Pack. Include:
- branch and working tree status;
- changed files and pre-existing dirty files;
- commands/tests run and verification gaps;
- deployment impact;
- auth/security/data impact;
- documentation/handover impact;
- decisions, risks, open questions;
- suggested Hermes vault updates.

Never include secret values.
