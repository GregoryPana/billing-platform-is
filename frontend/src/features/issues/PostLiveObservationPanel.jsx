import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { useAppData } from "../../context/AppDataContext"
import { IssueActivityDialog } from "./IssueActivityDialog"
import { IssueFormDialog } from "./IssueFormDialog"
import { list_finance_issues, list_issue_classifications } from "./issue-api"
import { describe_issue_status } from "./issue-status"

/* Finance-only post-live learning capture (docs/FINANCE_ISSUE_CONTROL_DESIGN.md
   section 3.3): history/trend evidence after Live, never a workflow gate.
   Mirrors FinanceIssuePanel's structure but drops the approval-blocking
   messaging and the reopen affordance (post_live_observation issues are not
   reopenable — enforced server-side in issues.py::reopen_issue). */
export function PostLiveObservationPanel({ cycle }) {
  const { role } = useAppData()
  const can_manage = role === "finance_user" || role === "system_admin"

  const [issues, set_issues] = useState([])
  const [classifications_by_id, set_classifications_by_id] = useState(new Map())
  const [loading, set_loading] = useState(true)
  const [error, set_error] = useState("")
  const [form_open, set_form_open] = useState(false)
  const [active_issue, set_active_issue] = useState(null)

  const reload = useCallback(async () => {
    try {
      set_loading(true)
      set_error("")
      const data = await list_finance_issues(cycle.id, "post_live_observation")
      set_issues(data)
      return data
    } catch (err) {
      set_error(err.message || "Failed to load post-live observations.")
      return []
    } finally {
      set_loading(false)
    }
  }, [cycle.id])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    list_issue_classifications("finance_review")
      .then((data) => set_classifications_by_id(new Map(data.map((item) => [item.id, item.name]))))
      .catch(() => {})
  }, [])

  const open_count = issues.filter((issue) => issue.status === "open").length
  const resolved_count = issues.filter(
    (issue) => issue.status === "completed" && issue.completion_outcome === "resolved"
  ).length
  const raised_in_error_count = issues.filter(
    (issue) => issue.status === "completed" && issue.completion_outcome === "raised_in_error"
  ).length

  return (
    <div className="mb-8">
      <div className="panel-subheader flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3>Post-live Observations</h3>
          <p>
            {can_manage
              ? "Finance-only learning captured after Live. These never block notifications or cycle completion."
              : "Finance-only observations recorded after Live, kept for trend history."}
          </p>
        </div>
        {can_manage && (
          <Button type="button" size="sm" onClick={() => set_form_open(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Log Post-live Observation
          </Button>
        )}
      </div>

      <div className="summary-card mb-4">
        <div>
          <span className="label">Open</span>
          <span>{open_count}</span>
        </div>
        <div>
          <span className="label">Completed — Resolved</span>
          <span>{resolved_count}</span>
        </div>
        <div>
          <span className="label">Completed — Raised in Error</span>
          <span>{raised_in_error_count}</span>
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      {loading ? (
        <div className="empty-state">Loading post-live observations…</div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          No post-live observations logged for this cycle yet.
          {can_manage ? " Logging one never blocks notifications or completion." : ""}
        </div>
      ) : (
        <div className="data-table mb-2">
          <div className="data-row table-head">
            <span>Title</span>
            <span>Classification</span>
            <span>Status</span>
            <span>Updated</span>
          </div>
          {issues.map((issue) => {
            const status = describe_issue_status(issue)
            return (
              <button
                key={issue.id}
                type="button"
                className="data-row w-full cursor-pointer bg-transparent text-left"
                onClick={() => set_active_issue(issue)}
              >
                <span className="stacked-cell font-medium text-foreground">{issue.title}</span>
                <span>{classifications_by_id.get(issue.classification_id) || "-"}</span>
                <span className="stacked-cell">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {status.note ? <span className="text-xs text-muted-foreground">{status.note}</span> : null}
                </span>
                <span>{new Date(issue.updated_at).toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      )}

      <IssueFormDialog
        open={form_open}
        onOpenChange={set_form_open}
        cycle_id={cycle.id}
        context="post_live_observation"
        on_created={reload}
      />
      <IssueActivityDialog
        open={Boolean(active_issue)}
        onOpenChange={(value) => !value && set_active_issue(null)}
        issue={active_issue}
        classification_name={active_issue ? classifications_by_id.get(active_issue.classification_id) : undefined}
        can_manage={can_manage}
        test_approved={false}
        on_changed={async () => {
          const data = await reload()
          if (active_issue) {
            set_active_issue(data.find((item) => item.id === active_issue.id) || null)
          }
        }}
      />
    </div>
  )
}
