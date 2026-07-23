# Finance Issue Control Design

**Status:** Proposed for approval before implementation
**Scope:** Monthly Billing Collaboration Platform workflow; no billing-engine automation

## 1. Purpose

The platform coordinates a monthly billing cycle. It must record the controlled evidence around test execution, Finance bill review, approval to proceed to Live, and post-live observations.

This design adds structured issue records without turning the platform into a general ticketing or assignment system. An issue belongs to one monthly billing cycle and is expected to be concluded within that cycle.

## 2. Roles

| Role | Responsibilities in this design |
| --- | --- |
| `billing_user` | Records Test/Live execution status and rare execution issues; reads Finance review issues to understand what needs attention; cannot complete, invalidate, reopen, or approve Finance issues. |
| `finance_user` | Reviews test-produced bills; creates, comments on, completes, invalidates, or reopens Finance review issues; approves/rejects progression to Live. Creates post-live observations. |
| `system_admin` | Has both Billing and Finance capabilities plus configuration and audit access. |

`viewer` is not part of the target role model and must not be carried into the Entra cutover.

## 3. Issue contexts

### 3.1 Execution issue

- **Creator:** Billing or Admin.
- **Linkage:** a specific script run, cycle and environment (`test` or `live`).
- **Purpose:** rare operational evidence, such as script failure, parameter issue, unexpected output, or environment/access problem.
- **Workflow effect:** the script run status remains the source of readiness. A failed/incomplete run prevents a stage becoming ready; merely logging an execution issue does not add an independent block.

### 3.2 Finance test-review issue — primary control

- **Creator:** Finance or Admin.
- **Linkage:** cycle + `test` approval checkpoint; optionally a related script run when known.
- **When:** after all required Test Preparation and Test Printing executions are completed, while Finance reviews the produced bills outside the platform.
- **Purpose:** record Finance findings and evidence before deciding whether Billing may proceed to Live.
- **Workflow effect:** every open Finance test-review issue blocks **Approve Move to Live**.

### 3.3 Post-live observation

- **Creator:** Finance or Admin only.
- **Linkage:** cycle + post-live checkpoint; optionally a related Live run.
- **Purpose:** capture after-the-fact learning/history after Live has completed.
- **Workflow effect:** never blocks notifications, cycle completion, or the next monthly cycle.

## 4. Classification

The initial controlled classification list applies to Finance test-review issues and post-live observations:

1. **Loyalty Points**
2. **Bill with Zero or Negative Value**
3. **Incorrect Product Setup**
4. **Other** — requires a detailed explanation.

Execution issues use an operational classification list to be agreed during implementation (for example script execution, parameters, environment/access, unexpected output, Other). This keeps Finance bill findings distinct from Billing run exceptions.

Classifications should be stored as configurable reference data rather than a hard-coded database enum, so an Admin can maintain approved future labels without a release. Deactivation, not destructive deletion, preserves historic reporting.

## 5. Finance issue lifecycle and audit rules

Finance owns the Finance issue lifecycle; there is no assignment, due-date, SLA, queue, or cross-cycle carry-over.

```text
Open ──> Completed: Resolved
  │
  └────> Completed: Raised in Error / Excluded from KPI reporting

Completed ──(Finance test-review only; before Move to Live approval; mandatory comment)──> Open
```

### Required issue information

- cycle ID and context (`finance_test_review` or `post_live_observation`);
- classification;
- concise title;
- detailed Finance comments;
- optional related script run;
- created by/at;
- status; and
- for completion: outcome and completed by/at. A completion comment is mandatory only for the `raised_in_error` outcome; it is optional for `resolved`.

### Completion outcomes

| Outcome | Meaning | Reporting treatment |
| --- | --- | --- |
| `resolved` | A genuine Finance finding was addressed or accepted by Finance. | Counts as a genuine issue. |
| `raised_in_error` | Finance later establishes that the issue was incorrect, duplicate, or not valid. Completion requires an explanation. | Retained for audit, excluded from headline issue counts and category/KPI trends. |

### Comments and edits

- Comments/activity are append-only.
- The original finding is never silently overwritten.
- If Finance corrects an issue field, record editor, timestamp, previous/new values and a mandatory edit comment.
- Finance may reopen a completed **test-review** issue only before Move to Live approval has been recorded, and only with a mandatory comment. After approval, the test-review issue history is read-only; a later finding is recorded as a post-live observation instead.
- Post-live observations are not reopened in the MVP; Finance can retain corrective context through append-only comments.
- No issue is deleted from the operational record.

## 6. Approval control

### Move to Live

Finance can request/record a decision only after required Test runs are complete.

- No Finance issues: Finance can approve or reject normally.
- One or more open Finance test-review issues: **Approve Move to Live is disabled**.
- All Finance test-review issues are completed (`resolved` or `raised_in_error`): Finance can approve or reject.
- Finance retains the ability to reject with comments even where no issue record was created.

The approval screen must explain the lock, show the open issue count, and link Finance/Billing to the relevant issue list.

### Post-live

Post-live observations are recorded after Live and are never an approval gate.

## 7. User journeys

### Billing: normal Test-to-Live path

1. Billing opens the monthly cycle workspace.
2. Billing generates and records Test runs.
3. When all required runs are executed, the Test Approval stage becomes ready.
4. Finance creates no issue, or logs/works through its review issues.
5. Billing reads Finance findings and comments to investigate/correct outside the platform.
6. Finance marks all findings completed and approves Move to Live.
7. Billing can enter the Live stage.

### Finance: test bill review with multiple findings

1. Finance opens the approval request/cycle.
2. Finance validates produced test bills outside the platform.
3. Finance selects **Log Finance Review Issue** for each finding.
4. Finance selects classification and enters title/detail.
5. Billing sees the issues read-only and acts on the findings.
6. Finance appends comments as checks progress.
7. Finance marks each issue **Completed — Resolved**, or **Completed — Raised in Error** with a mandatory explanation.
8. Once no Finance issue remains open, Finance selects **Approve Move to Live**.

### Finance: post-live observation

1. Finance opens the completed/post-live cycle stage.
2. Finance selects **Log Post-live Observation**.
3. Finance records classification and comments.
4. The record remains available for monthly trend reporting but does not change cycle completion.

## 8. UX requirements

### Finance Test Approval stage

Place the Finance review control before the approval action:

1. cycle/test readiness summary;
2. Finance review issue summary: Open, Completed—Resolved, Completed—Raised in Error;
3. Finance issue list with classification, title, status, created/updated timestamps and a clear excluded marker;
4. issue detail/activity panel or dialog;
5. approval decision panel, disabled with explanatory copy while issues are open.

### Billing visibility

Billing sees the same issue list and comment history, but Finance-only controls are absent/disabled. The page must plainly say that Finance confirms completion and controls movement to Live.

### UI standard

Use the existing CWS SaaS design system, semantic tokens and project UI primitives. Use clear status labels; do not rely on colour alone. Support empty, loading, error, completed, raised-in-error and reopened states.

## 9. KPI/reporting contract

Headline reporting must count only genuine (`resolved`) Finance findings. `raised_in_error` records remain available in audit/detail reporting but are excluded from headline issue and classification trends.

Support these decisions:

| Metric | Decision supported |
| --- | --- |
| Finance test-review issues by monthly cycle | Is quality stable before Live approval? |
| Issues by approved Finance classification | Which recurring bill-quality problem needs prevention? |
| Test-review vs post-live observations | Are controls finding issues early enough? |
| Time from finding to Finance completion | Is the monthly review process clearing findings efficiently? |
| Cycle approval blocked by open issues | Where did issue resolution delay the cycle? |
| Raised-in-error count, shown separately | Is issue logging guidance/classification being applied accurately? |

Do not capture or infer financial values in the MVP. Any future monetary impact field needs a Finance-approved calculation and data-handling decision.

## 10. Explicit exclusions

- no issue assignment;
- no due dates, SLAs, workload queues or team routing;
- no cross-cycle carry-over workflow;
- no automated execution of Cerillion/billing commands;
- no automatic approval;
- no attachment/file upload in MVP;
- no financial impact estimate in MVP.
