import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Inbox } from "../../lib/icons"

import { api_fetch } from "../../api"
import { show_toast, useDataScope, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { Button } from "../../components/ui/button"
import { Panel, PanelHeader, PanelTitle, PanelDescription } from "../../components/ui/panel"
import { DataTable, DataTableRow } from "../../components/ui/data-table"
import { EmptyState } from "../../components/ui/empty-state"
import { cycle_month_pair, format_stage_label } from "../../lib/format"

/* Finance-facing decision queue. Deep-linkable per request via /approvals/:id. */
const APPROVALS_SCOPE = ["cycles", "approvals"]

export function ApprovalsInboxPage() {
  useDataScope(APPROVALS_SCOPE)
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
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Pending Requests</PanelTitle>
            <PanelDescription>Select a request to review the message from billing and record your decision.</PanelDescription>
          </div>
        </PanelHeader>
        {pending_approvals.length === 0 ? (
          <EmptyState>
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            No pending approvals. New requests from billing will appear here.
          </EmptyState>
        ) : (
          <DataTable>
            <DataTableRow head>
              <span>Cycle</span>
              <span>Stage</span>
              <span>Requested</span>
              <span>Action</span>
            </DataTableRow>
            {pending_approvals.map((approval) => {
              const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
              const is_expanded = String(expanded_id) === String(approval.id)
              const decision = get_decision(approval.id)
              return (
                <div key={approval.id} className="flex flex-col">
                  <DataTableRow
                    className="cursor-pointer"
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
                  </DataTableRow>
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
          </DataTable>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Decision History</PanelTitle>
            <PanelDescription>Completed approvals across all billing cycles.</PanelDescription>
          </div>
        </PanelHeader>
        <DataTable>
          <DataTableRow head>
            <span>Cycle</span>
            <span>Stage</span>
            <span>Status</span>
            <span>Updated</span>
          </DataTableRow>
          {history.length === 0 ? (
            <EmptyState>No completed approvals yet.</EmptyState>
          ) : (
            history.map((approval) => {
              const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
              const is_expanded = String(expanded_id) === String(approval.id)
              return (
                <div key={approval.id} className="flex flex-col">
                  <DataTableRow
                    className="cursor-pointer"
                    onClick={() => set_expanded_id(is_expanded ? null : approval.id)}
                  >
                    <span>{cycle_month_pair(cycle)}</span>
                    <span>{format_stage_label(approval.stage)}</span>
                    <span>
                      <StatusBadge status={approval.status} />
                    </span>
                    <span>{new Date(approval.updated_at).toLocaleString()}</span>
                  </DataTableRow>
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
        </DataTable>
      </Panel>
    </>
  )
}
