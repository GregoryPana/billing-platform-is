import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Inbox } from "lucide-react"

import { api_fetch } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { Button } from "../../components/ui/button"
import { cycle_month_pair, format_stage_label } from "../../lib/format"

/* Finance-facing decision queue. Deep-linkable per request via /approvals/:id. */
export function ApprovalsInboxPage() {
  const { approval_id } = useParams()
  const navigate = useNavigate()
  const { approvals, pending_approvals, cycles_by_id, reload_all, set_error_message } = useAppData()

  const [expanded_id, set_expanded_id] = useState(approval_id || null)
  const [decision_forms, set_decision_forms] = useState({})
  const [submitting_id, set_submitting_id] = useState(null)

  useEffect(() => {
    if (approval_id) {
      set_expanded_id(approval_id)
    }
  }, [approval_id])

  const history = useMemo(() => approvals.filter((approval) => approval.status !== "pending"), [approvals])

  const get_decision = (id) => decision_forms[id] || { status: "approved", comments: "" }
  const set_decision = (id, patch) =>
    set_decision_forms((previous) => ({ ...previous, [id]: { ...get_decision(id), ...patch } }))

  const handle_decide = async (approval) => {
    const decision = get_decision(approval.id)
    try {
      set_submitting_id(approval.id)
      await api_fetch("/approvals/", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle_id: String(approval.billing_cycle_id),
          stage: approval.stage,
          status: decision.status,
          comments: decision.comments,
        }),
      })
      show_toast("Approval decision recorded.", "success")
      set_expanded_id(null)
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not record the approval decision.", "error")
    } finally {
      set_submitting_id(null)
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pending Requests</h2>
            <p>Select a request to review the message from billing and record your decision.</p>
          </div>
        </div>
        {pending_approvals.length === 0 ? (
          <div className="empty-state">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            No pending approvals. New requests from billing will appear here.
          </div>
        ) : (
          <div className="data-table">
            <div className="data-row table-head">
              <span>Cycle</span>
              <span>Stage</span>
              <span>Requested</span>
              <span>Action</span>
            </div>
            {pending_approvals.map((approval) => {
              const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
              const is_expanded = String(expanded_id) === String(approval.id)
              const decision = get_decision(approval.id)
              return (
                <div key={approval.id} className="flex flex-col">
                  <div
                    className="data-row cursor-pointer"
                    onClick={() => set_expanded_id(is_expanded ? null : approval.id)}
                  >
                    <span>{cycle_month_pair(cycle)}</span>
                    <span>{format_stage_label(approval.stage)}</span>
                    <span>{new Date(approval.updated_at).toLocaleString()}</span>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          set_expanded_id(is_expanded ? null : approval.id)
                        }}
                      >
                        {is_expanded ? "Close" : "Review"}
                      </Button>
                    </span>
                  </div>
                  {is_expanded && (
                    <div className="detail-card">
                      <strong>Message from billing</strong>
                      <p>{approval.comments || "No comments provided."}</p>
                      {approval.stage === "test" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => navigate(`/cycles/${approval.billing_cycle_id}`)}
                        >
                          Review Finance Issues in Cycle Workspace
                        </Button>
                      )}
                      <form
                        className="mt-4 grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault()
                          handle_decide(approval)
                        }}
                      >
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Decision
                            <select
                              className="select-inline min-w-[160px]"
                              value={decision.status}
                              onChange={(event) => set_decision(approval.id, { status: event.target.value })}
                            >
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                          <label className="flex flex-1 basis-64 flex-col gap-2 text-sm font-medium">
                            Comments
                            <input
                              className="input-field"
                              value={decision.comments}
                              onChange={(event) => set_decision(approval.id, { comments: event.target.value })}
                              placeholder="Optional note for billing"
                            />
                          </label>
                          <Button type="submit" disabled={submitting_id === approval.id}>
                            {submitting_id === approval.id ? "Submitting…" : "Submit Decision"}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Decision History</h2>
            <p>Completed approvals across all billing cycles.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row table-head">
            <span>Cycle</span>
            <span>Stage</span>
            <span>Status</span>
            <span>Updated</span>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">No completed approvals yet.</div>
          ) : (
            history.map((approval) => {
              const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
              const is_expanded = String(expanded_id) === String(approval.id)
              return (
                <div key={approval.id} className="flex flex-col">
                  <div
                    className="data-row cursor-pointer"
                    onClick={() => set_expanded_id(is_expanded ? null : approval.id)}
                  >
                    <span>{cycle_month_pair(cycle)}</span>
                    <span>{format_stage_label(approval.stage)}</span>
                    <span>
                      <StatusBadge status={approval.status} />
                    </span>
                    <span>{new Date(approval.updated_at).toLocaleString()}</span>
                  </div>
                  {is_expanded && (
                    <div className="detail-card">
                      <strong>Details &amp; Comments</strong>
                      <p>{approval.comments || "No comments provided."}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>
    </>
  )
}
