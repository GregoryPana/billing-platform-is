# Finance User Guide 📊

This guide focuses on finance checkpoints in the billing workflow. It explains when to review, what to verify, and how approvals affect the next stage.

## Your Role

- Review billing approval requests.
- Approve when results are complete and consistent.
- Reject with clear comments when corrections are needed.
- Do not run scripts or notification commands.

## When You Get Involved

Finance actions happen at two required stages:

1. **Move to live** (after test runs are complete).
2. **Move to notifications** (after live run and printing are complete).

## Step 1: Review Move to Live Request ✅

**Where:** Go to **Approvals**.

![Step 1: Review Move to Live](/billing/user-guide/finance-approvals.png)

**What to do:**

- Open the request for the billing cycle.
- Review comments and confirm test runs are complete.
- Click **Approve** or **Reject**.

**What should happen next:**

- If approved, billing can generate live scripts.
- If rejected, billing updates the run and submits again.

## Step 2: Review Move to Notifications Request ✅

**Where:** Go to **Approvals**.

![Step 2: Review Move to Notifications](/billing/user-guide/finance-approvals-live.png)

**What to do:**

- Confirm live billing and printing are complete.
- Click **Approve** or **Reject**.

**What should happen next:**

- If approved, billing can generate notification commands.
- If rejected, billing resolves issues and resubmits.

## Quick Decision Checklist

- Are required test/live steps completed?
- Are there unresolved errors in comments or logs?
- Is supporting context clear enough to approve safely?

If unsure, reject and leave a clear action comment.

## Rejection Comment Examples

- "Test run missing for selected cycle"
- "Live printing confirmation not provided"
- "Please rerun failed script and resubmit"
