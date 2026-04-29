# Billing Platform User Guide

This guide explains how to use the billing platform. It covers the workflow from creating a billing cycle all the way through generating notifications.

---

## Who this guide is for

- **Billing users**: run billing, generate scripts and notifications, and track progress.
- **Finance users**: review and approve key steps before billing can move forward.
- **View-only users**: can read progress but cannot change anything.
- **Admins**: manage user access.

---

## Roles and responsibilities

### Billing user

- Creates the billing cycle for the month.
- Generates the required scripts for test and live runs.
- Executes the scripts in the backend environment.
- Updates run status as each step completes.
- Requests approvals from finance at the correct points.
- Generates notification commands after approvals are granted.

### Finance user

- Reviews requests from billing.
- Approves or rejects:
  - **Move to live** (after test runs are done).
  - **Move to notifications** (after live runs finish).
- Provides comments if something needs to be corrected.

---

## End-to-end flow at a glance

1. **Billing** creates the billing cycle.
2. **Billing** generates **test scripts** and runs them.
3. **Billing** tracks results and requests **finance approval to move to live**.
4. **Finance** approves (or rejects with comments).
5. **Billing** generates **live scripts** and runs them.
6. **Billing** requests **finance approval that live is complete**.
7. **Finance** approves.
8. **Billing** generates **notification commands** (email + SMS) and runs them.
9. **Billing** confirms completion and reviews the audit log.

---

## Step-by-step guide

### Step 1: Create a billing cycle

**Where:** Go to **Billing Cycles** in the sidebar.

What to do:

- Choose the **Usage month** and **Billing month**.
- Add notes if needed (for example: "February billing for January usage").
- Click **Create cycle**.

What should happen next:

- You will see the new cycle in the list.
- The cycle status shows in the overview cards.

---

### Step 2: Generate test scripts

**Where:** Go to **Script Generation** in the sidebar.

What to do:

- Select the cycle you just created.
- Set **Environment = Test**.
- Choose **Script type**:
  - **Preparation** for bill generation. *(Note: the p3 parameter automatically defaults to the first day of the next month).*
  - **Printing** for bill printing.
- Select the cycle types that apply to the run.
- Click **Generate scripts**.

What should happen next:

- The generated commands appear in the table.
- Copy the commands and run them in the backend environment.

---

### Step 3: Track test runs

**Where:** Go to **Runs Tracking** in the sidebar.

What to do:

- Select the billing cycle.
- For each generated script, update the status:
  - **Planned** if it has not started.
  - **Executed** once it has run.
  - **Failed** if errors occurred.

What should happen next:

- When all required test scripts are marked **Executed**, you are ready to request finance approval.

---

### Step 4: Request approval to move to live

**Where:** Go to **Approvals** in the sidebar.

What to do:

- Select the billing cycle.
- Select stage **Move to live**.
- Select which **Finance recipients** should receive the approval request.
- Add a short comment (for example: "Test run completed, no errors").
- Click **Request approval**.

What should happen next:

- Finance receives the request and reviews it.
- You must wait until finance approves before generating live scripts.

---

### Step 5: Finance reviews "Move to live"

**Where:** (Finance user) - Go to **Approvals**

What to do:

- Review the request details and any notes.
- Click **Approve** if results are acceptable.
- Click **Reject** if corrections are needed, and add a comment explaining why.

What should happen next:

- If approved, billing can generate **live** scripts.
- If rejected, billing corrects the issue and submits again.

---

### Step 6: Generate live scripts

**Where:** Go to **Script Generation**

What to do:

- Select the same billing cycle.
- Set **Environment = Live**.
- Choose the needed **Script type** (Preparation, then Printing).
- Click **Generate scripts** and run them.

What should happen next:

- Track progress in **Runs Tracking** until all live steps are marked Executed.

---

### Step 7: Request approval that live is complete

**Where:** Go to **Approvals**

What to do:

- Select the billing cycle.
- Select stage **Move to notifications**.
- Add a short comment (for example: "Live run completed, printing complete").
- Click **Request approval**.

What should happen next:

- Finance reviews and approves before moving to notifications.

---

### Step 8: Finance reviews "Live complete"

**Where:** (Finance user) - Go to **Approvals**

What to do:

- Approve if live billing is complete and consistent.
- Reject with clear comments if something is missing.

What should happen next:

- If approved, billing can move to notifications.

---

### Step 9: Generate notification commands

**Where:** Go to **Notifications** in the sidebar.

What to do:

- Select the billing cycle.
- Choose the **Notification date** (the day the notifications should be processed).
- Click **Generate command**.
- Use **Download commands** to save a text file for the run.

What should happen next:

- The commands shown are the official steps for email and SMS notifications.
- Execute them in the backend.
- Track completion and resolve any errors.

---

### Step 10: Confirm completion and review audit log

**Where:** Go to **Audit Log** in the sidebar.

What to do:

- Review the audit log entries for the cycle.
- Check the **Result** column to easily see if actions were **success**, **executed**, **approved**, or **failed** at a glance.
- Confirm that approvals, script generation, and notification commands are all recorded.

What should happen next:

- The billing run is complete for this cycle.
- If any step is missing, return to that step and finish it.

---

## Common questions

### "What if I do not see a command?"

- Ensure you have selected a billing cycle and the correct environment.
- Make sure finance approvals are complete for the step you are trying to run.

### "What if finance rejects a request?"

- Read the comment, fix the issue, then submit the request again.

### "Do I run the scripts inside the app?"

- No. The app **generates commands**. They must be executed in the backend environment.

---

## Summary checklist (billing user)

- Create cycle
- Generate and run test scripts
- Track test results
- Request "Move to live" approval
- Generate and run live scripts
- Request "Move to notifications" approval
- Generate notification commands
- Run notifications and confirm completion
- Review audit log

## Summary checklist (finance user)

- Review and approve "Move to live"
- Review and approve "Move to notifications"