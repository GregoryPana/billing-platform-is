# Billing Platform User Guide (Billing + Finance)

This guide explains the full billing process from start to finish. It is written for non-technical users and shows exactly who does what, when handoffs happen, and what should be done after each step.

---

## Who this guide is for

- **Billing users**: run billing, generate scripts and notifications, and track progress.
- **Finance users**: review and approve key steps before billing can move forward.
- **View-only users**: can read progress but cannot change anything.
- **Admins**: manage user access. Admins do not run billing unless they also have a billing role.

---

## Roles and responsibilities

### Billing user

- Creates the billing cycle for the month.
- Generates the required scripts for test and live runs.
- Executes the scripts in the backend environment (or coordinates with the technical team).
- Updates run status as each step completes.
- Requests approvals from finance at the correct points.
- Generates notification commands after approvals and shares them with the team running notifications.

### Finance user

- Reviews requests from billing.
- Approves or rejects:
  - **Move to live** (after test runs are done).
  - **Live complete** (after live runs finish).
  - **Move to notifications** (after post-live checks are done).
- Provides comments if something needs to be corrected.

---

## End-to-end flow at a glance

1. Billing user creates the billing cycle.
2. Billing user generates **test scripts** and runs them.
3. Billing user tracks results and requests **finance approval to move to live**.
4. Finance user approves (or rejects with comments).
5. Billing user generates **live scripts** and runs them.
6. Billing user requests **finance approval that live is complete**.
7. Finance user approves.
8. Billing user generates **notification commands** (email + SMS) and runs them.
9. Billing user confirms completion and reviews the audit log.

---

## Step-by-step guide

### Step 1: Create a billing cycle (Billing user)

**Where:** `Billing Cycles`

![Step 1: Create a billing cycle](/billing/user-guide/billing-cycle.png)

What to do:

- Choose the **Usage month** and **Billing month**.
- Add notes if needed (for example: “February billing for January usage”).
- Click **Create cycle**.

What should happen next:

- You will see the new cycle in the list.
- The cycle status starts as **Test Run Phase**.

Example:

```
Usage month: 2026-01
Billing month: 2026-02
Notes: January usage billed in February
```

---

### Step 2: Generate test scripts (Billing user)

**Where:** `Script Generation`

![Step 2.1: Select Billing Cycle and Script Type](/billing/user-guide/script-gen.png)

![Step 2.2: Set Parameters](/billing/user-guide/script-gen-params.png)

What to do:

- Select the cycle you just created.
- Set **Environment = Test**.
- Choose **Script type**:
  - **Preparation** for bill generation. *(Note: the `p3` parameter automatically defaults to the first day of the next month).*
  - **Printing** for bill printing.
- Select the cycle types that apply to the run.
- Click **Generate scripts**.

What should happen next:

- The generated commands appear in the table.
- Copy the commands and run them in the backend environment (or send them to the technical team).

Example (illustrative only):

```
P1='M1A' P2='T' P3='2026_02_01 00:00:00' ... /cer_cerprod/exe/pspbil0101b.sh
```

---

### Step 3: Track test runs (Billing user)

**Where:** `Runs Tracking`

![Step 3: Track Runs](/billing/user-guide/runs-tracking.png)

What to do:

- For each generated script, update the status to match what happened:
  - **Planned** if it has not started.
  - **Executed** once it has run.
  - **Failed** if errors occurred.

What should happen next:

- When all required test scripts are marked **Executed**, you are ready to request finance approval.

---

### Step 4: Request approval to move to live (Billing user)

**Where:** `Approvals`

![Step 4: Request Approval to Move to Live](/billing/user-guide/approvals.png)

What to do:

- Choose the billing cycle.
- Select stage **Move to live**.
- Check the relevant boxes to select which **Finance recipients** should receive the approval email notification (which contains a direct link to the request).
- Add a short comment (for example: “Test run completed, no errors”).
- Submit the request.

What should happen next:

- Finance receives the request and reviews it.
- You must wait until finance approves before generating live scripts.

---

### Step 5: Finance reviews “Move to live” (Finance user)

**Where:** `Approvals`
![Step 5.1: Review Cycle](/billing/user-guide/review-cycle.png)

![Step 5.2: Approving the Cycle](/billing/user-guide/finance-approvals.png)
What to do:

- Review the request details and any notes.
- Approve if results are acceptable.
- Reject if corrections are needed, and add a comment explaining why.

What should happen next:

- If approved, billing can generate **live** scripts.
- If rejected, billing corrects the issue and submits again. *(Tip: You can read exactly why Finance rejected the cycle by simply clicking on the denied request in your Approvals table, which will expand to reveal their specific comments).*

---

### Step 6: Generate live scripts (Billing user)

**Where:** `Script Generation`
![Step 6: Switch to Live and Printing](/billing/user-guide/move-to-live.png)

What to do:

- Select the same billing cycle.
- Set **Environment = Live**.
- Choose the needed **Script type** (Preparation, then Printing).
- Click **Generate scripts** and run them.

What should happen next:

- Track progress in `Runs Tracking` until all live steps are successful.

---

### Step 7: Request approval that live is complete (Billing user)

**Where:** `Approvals`
![Step 7: Stage Change and Request Approval](/billing/user-guide/approvals-live.png)
What to do:

- Select stage **Live complete**.
- Add a short comment (for example: “Live run completed, printing complete”).
- Submit the request.

What should happen next:

- Finance reviews and approves before moving to notifications.

---

### Step 8: Finance reviews “Live complete” (Finance user)

**Where:** `Approvals`
![Step 8: Stage Change and Request Approval](/billing/user-guide/finance-approvals-live.png)

What to do:

- Approve if live billing is complete and consistent.
- Reject with clear comments if something is missing.

What should happen next:

- If approved, billing can move to notifications.

---

### Step 9: Generate notification commands (Billing user)

**Where:** `Notifications`

![Step 9: Stage Change and Request Approval](/billing/user-guide/notifications.png)
What to do:

- Select the billing cycle.
- Choose the **Notification date** (the day the notifications should be processed).
- Click **Generate command**.
- Use **Download commands** to save a text file for the run.

What should happen next:

- The commands shown are the official steps for email and SMS notifications.
- Execute them in the backend (or pass them to the technical team).
- Track completion and resolve any errors shown by the logs.

Example (illustrative only):

```
Notification date: 2026-02-05
Email: /cer_cerprod/Dominique/EMAIL_NOTIFICATION_FOR_REAL_BILL_FINAL.sh
SMS:   /cer_cerprod/Dominique/SMS_NOTIFICATION_FOR_REAL_BILL.sh
```

---

### Step 10: Confirm completion and review audit log (Billing user)

**Where:** `Audit Log`

What to do:

- Review the audit log entries for the cycle.
- Check the **Result** column to easily see if actions were `success`, `executed`, `approved`, or `failed` at a glance.
- Confirm that approvals, script generation, and notification commands are all recorded.

What should happen next:

- The billing run is complete for this cycle.
- If any step is missing, return to that step and finish it.

---

## Common questions (non-technical)

### “What if I do not see a command?”

- Ensure you have selected a billing cycle and the correct environment.
- Make sure finance approvals are complete for the step you are trying to run.

### “What if finance rejects a request?”

- Read the comment, fix the issue, then submit the request again.

### “Do I run the scripts inside the app?”

- No. The app **generates commands**. They must be executed in the backend environment by the billing team or technical team.

---

## Summary checklist (billing user)

- Create cycle
- Generate and run test scripts
- Track test results
- Request “Move to live” approval
- Generate and run live scripts
- Request “Live complete” approval
- Generate notification commands
- Run notifications and confirm completion
- Review audit log

## Summary checklist (finance user)

- Review and approve “Move to live”
- Review and approve “Live complete”
- Review and approve “Move to notifications” if required by policy
