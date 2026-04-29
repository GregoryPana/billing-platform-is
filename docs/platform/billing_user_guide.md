# Billing Platform User Guide 📘

This guide explains the full billing process from start to finish. It shows exactly who does what, when handoffs happen, and what should be done after each step.

---

## Who This Guide Is For 👥

- **Billing users** 💼: Run billing, generate scripts and notifications, and track progress.
- **Finance users** 📊: Review and approve key steps before billing can move forward.
- **View-only users** 👁️: Can read progress but cannot change anything.
- **Admins** 🔧: Manage user access.

---

## Roles and Responsibilities 👔

### Billing User 💰

- Creates the billing cycle for the month.
- Generates the required scripts for test and live runs.
- Executes the scripts in the backend environment.
- Updates run status as each step completes.
- Requests approvals from finance at the correct points.
- Generates notification commands after approvals are granted.

### Finance User 📋

- Reviews requests from billing.
- Approves or rejects:
  - **Move to live** ✅ (after test runs are done)
  - **Move to notifications** 📧 (after live runs finish)
- Provides comments if something needs to be corrected.

---

## End-to-End Flow 🔄

1. Billing creates the billing cycle 📝
2. Billing generates test scripts and runs them 🧪
3. Billing tracks results and requests finance approval to move to live 🚦
4. Finance approves (or rejects with comments) ✔️
5. Billing generates live scripts and runs them ⚡
6. Billing requests finance approval that live is complete 🔚
7. Finance approves ✔️
8. Billing generates notification commands (email + SMS) 📧
9. Billing confirms completion and reviews the audit log 📋

---

## Step 1: Create a Billing Cycle 📝

**Where:** Go to 💳 **Billing Cycles** in the sidebar.

![Step 1: Create a billing cycle](/billing/user-guide/billing-cycle.png)

**What to do:**

- Choose the Usage month and Billing month.
- Add notes if needed (for example: "February billing for January usage").
- Click Create cycle.

**What should happen next:**

- You will see the new cycle in the list.
- The cycle status shows in the overview cards.

---

## Step 2: Generate Test Scripts 🧪

**Where:** Go to 📜 **Script Generation** in the sidebar.

![Step 2.1: Select Billing Cycle and Script Type](/billing/user-guide/script-gen.png)

![Step 2.2: Set Parameters](/billing/user-guide/script-gen-params.png)

**What to do:**

- Select the cycle you just created.
- Set Environment = Test.
- Choose Script type:
  - **Preparation** for bill generation (Note: the p3 parameter automatically defaults to the first day of the next month)
  - **Printing** for bill printing
- Select the cycle types that apply to the run.
- Click Generate scripts.

**What should happen next:**

- The generated commands appear in the table.
- Copy the commands and run them in the backend environment.

---

## Step 3: Track Test Runs 📊

**Where:** Go to ▶️ **Runs Tracking** in the sidebar.

![Step 3: Track Runs](/billing/user-guide/runs-tracking.png)

**What to do:**

- Select the billing cycle.
- For each generated script, update the status:
  - **Planned** ⏳ if it has not started
  - **Executed** ✅ once it has run
  - **Failed** ❌ if errors occurred

**What should happen next:**

- When all required test scripts are marked Executed, you are ready to request finance approval.

---

## Step 4: Request Approval to Move to Live 🚦

**Where:** Go to ✅ **Approvals** in the sidebar.

![Step 4: Request Approval to Move to Live](/billing/user-guide/approvals.png)

**What to do:**

- Select the billing cycle.
- Select stage Move to live.
- Select which Finance recipients should receive the approval request.
- Add a short comment (for example: "Test run completed, no errors").
- Click Request approval.

**What should happen next:**

- Finance receives the request and reviews it.
- You must wait until finance approves before generating live scripts.

---

## Step 5: Finance Reviews Move to Live ✔️

**Where:** Go to ✅ **Approvals** (Finance user only)

![Step 5.1: Review Cycle](/billing/user-guide/review-cycle.png)

![Step 5.2: Approving the Cycle](/billing/user-guide/finance-approvals.png)

**What to do:**

- Review the request details and any notes.
- Click Approve if results are acceptable.
- Click Reject if corrections are needed, and add a comment explaining why.

**What should happen next:**

- If approved, billing can generate live scripts.
- If rejected, billing corrects the issue and submits again.

---

## Step 6: Generate Live Scripts ⚡

**Where:** Go to 📜 **Script Generation**.

![Step 6: Switch to Live and Printing](/billing/user-guide/move-to-live.png)

**What to do:**

- Select the same billing cycle.
- Set Environment = Live.
- Choose Script type (Preparation, then Printing).
- Click Generate scripts and run them.

**What should happen next:**

- Track progress in Runs Tracking until all live steps are marked Executed.

---

## Step 7: Request Approval for Notifications 📧

**Where:** Go to ✅ **Approvals**.

![Step 7: Stage Change and Request Approval](/billing/user-guide/approvals-live.png)

**What to do:**

- Select the billing cycle.
- Select stage Move to notifications.
- Add a short comment (for example: "Live run completed, printing complete").
- Click Request approval.

**What should happen next:**

- Finance reviews and approves before moving to notifications.

---

## Step 8: Finance Reviews Move to Notifications ✔️

**Where:** Go to ✅ **Approvals** (Finance user only).

![Step 8: Stage Change and Request Approval](/billing/user-guide/finance-approvals-live.png)

**What to do:**

- Approve if live billing is complete and consistent.
- Reject with clear comments if something is missing.

**What should happen next:**

- If approved, billing can move to notifications.

---

## Step 9: Generate Notification Commands 📧

**Where:** Go to 🔔 **Notifications** in the sidebar.

![Step 9: Generate Notifications](/billing/user-guide/notifications.png)

**What to do:**

- Select the billing cycle.
- Choose the Notification date (the day the notifications should be processed).
- Click Generate command.
- Use Download commands to save a text file for the run.

**What should happen next:**

- The commands shown are the official steps for email and SMS notifications.
- Execute them in the backend.
- Track completion and resolve any errors.

---

## Step 10: Confirm Completion and Review Audit Log 📋

**Where:** Go to 📝 **Audit Log** in the sidebar.

**What to do:**

- Review the audit log entries for the cycle.
- Check the Result column to see if actions were success, executed, approved, or failed.
- Confirm that approvals, script generation, and notification commands are all recorded.

**What should happen next:**

- The billing run is complete for this cycle.
- If any step is missing, return to that step and finish it.

---

## Step 11: Configure Request Settings (Optional) ⚙️

**Where:** Go to ⚙️ **Request Settings** in the sidebar.

**What to do:**

- The Request Settings page lets you configure who receives approval request emails.
- Add finance email addresses in the Finance recipients section.
- Enter an email address and click Add.
- Use the checkboxes to select which recipients should receive each request.

**What should happen next:**

- When you submit future approval requests, the selected finance users will receive email notifications automatically.

---

## Common Questions ❓

### What if I do not see a command?

- Make sure you have selected a billing cycle and the correct environment.
- Make sure finance approvals are complete for the step you are trying to run.

### What if finance rejects a request?

- Read the comment, fix the issue, then submit the request again.

### Do I run the scripts inside the app?

- No. The app generates commands. They must be executed in the backend environment.

---

## Summary Checklist ✅

### Billing User 💰

- [ ] Create cycle 📝
- [ ] Generate and run test scripts 🧪
- [ ] Track test results 📊
- [ ] Request Move to live approval 🚦
- [ ] Generate and run live scripts ⚡
- [ ] Request Move to notifications approval 📧
- [ ] Generate notification commands 📧
- [ ] Run notifications and confirm completion 🔔
- [ ] Review audit log 📋

### Finance User 📋

- [ ] Review and approve Move to live ✔️
- [ ] Review and approve Move to notifications ✔️