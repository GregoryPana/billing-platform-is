import { useEffect, useMemo, useState } from "react"

import { api_fetch } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { FinanceIssuePanel } from "../issues/FinanceIssuePanel"
import { compute_stage_ready, cycle_month_pair, format_stage_label } from "../../lib/format"

/* Approval checkpoint for one cycle+stage. Billing requests here (recipients
   chosen at send time); finance/admin can decide here or in the inbox. */
export function ApprovalStage({ cycle, stage }) {
  const {
    role,
    current_user,
    scripts,
    runs_by_script_id,
    approvals_by_cycle_stage,
    finance_recipients,
    request_settings,
    reload_all,
    set_error_message,
  } = useAppData()

  const can_request = role === "billing_user" || role === "system_admin"
  const can_decide = role === "finance_user" || role === "system_admin"
  const environment = stage === "test" ? "test" : "live"
  const approval = approvals_by_cycle_stage.get(`${cycle.id}:${stage}`)

  const ready = useMemo(
    () => compute_stage_ready(cycle.id, environment, scripts, runs_by_script_id),
    [cycle, environment, scripts, runs_by_script_id]
  )
  const request_allowed = ready && (!approval || !["pending", "approved"].includes(approval.status))

  const [selected_recipients, set_selected_recipients] = useState(finance_recipients)
  const [message, set_message] = useState(request_settings.default_message || "")
  const [sending, set_sending] = useState(false)
  const [decision, set_decision] = useState({ status: "approved", comments: "" })
  const [deciding, set_deciding] = useState(false)
  const [open_finance_issue_count, set_open_finance_issue_count] = useState(0)
  const move_to_live_blocked = stage === "test" && open_finance_issue_count > 0

  useEffect(() => {
    set_selected_recipients(finance_recipients)
  }, [finance_recipients])

  useEffect(() => {
    set_message((previous) => previous || request_settings.default_message || "")
  }, [request_settings.default_message])

  const readiness_note = !ready
    ? "Execute all preparation and printing scripts for this stage first."
    : approval?.status === "pending"
    ? "Approval already requested — waiting on finance."
    : approval?.status === "approved"
    ? "Approval already granted."
    : "All scripts executed. You can request approval."

  const toggle_recipient = (email) => {
    set_selected_recipients((previous) =>
      previous.includes(email) ? previous.filter((item) => item !== email) : [...previous, email]
    )
  }

  const handle_request = async (event) => {
    event.preventDefault()
    if (selected_recipients.length === 0) {
      show_toast("Select at least one finance recipient.", "error")
      return
    }
    try {
      set_sending(true)
      await api_fetch("/approvals/request", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle_id: String(cycle.id),
          stage,
          comments: message,
          recipients: selected_recipients,
          app_link: `${window.location.origin}${window.location.pathname}#/approvals`,
        }),
      })
      show_toast("Approval request sent to selected recipients.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Failed to send approval request.", "error")
    } finally {
      set_sending(false)
    }
  }

  const handle_decision = async (event) => {
    event.preventDefault()
    try {
      set_deciding(true)
      await api_fetch("/approvals/", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle_id: String(cycle.id),
          stage,
          status: decision.status,
          comments: decision.comments,
        }),
      })
      show_toast("Approval decision recorded.", "success")
      set_decision({ status: "approved", comments: "" })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not record the approval decision.", "error")
    } finally {
      set_deciding(false)
    }
  }

  return (
    <>
      <div className="summary-card mb-6">
        <div>
          <span className="label">Cycle</span>
          <span>{cycle_month_pair(cycle)}</span>
        </div>
        <div>
          <span className="label">Stage</span>
          <span>{format_stage_label(stage)}</span>
        </div>
        <div>
          <span className="label">Status</span>
          <span>{approval ? <StatusBadge status={approval.status} /> : "Not requested yet"}</span>
        </div>
        {approval ? (
          <div>
            <span className="label">Updated</span>
            <span>{new Date(approval.updated_at).toLocaleString()}</span>
          </div>
        ) : null}
      </div>

      {approval?.comments ? (
        <div className="mb-6 rounded-md bg-muted p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Comments</p>
          <p className="m-0 text-sm text-foreground">{approval.comments}</p>
        </div>
      ) : null}

      {stage === "test" && (
        <FinanceIssuePanel
          cycle={cycle}
          test_approved={approval?.status === "approved"}
          on_open_count_change={set_open_finance_issue_count}
        />
      )}

      {can_request && (
        <>
          <div className="panel-subheader">
            <h3>Request Approval</h3>
            <p>{readiness_note}</p>
          </div>
          <form className="form-grid" onSubmit={handle_request}>
            <div className="full">
              <p className="helper">Finance recipients</p>
              {finance_recipients.length === 0 ? (
                <div className="empty-state">
                  No finance recipients configured. Add them under Administration → Settings.
                </div>
              ) : (
                <div className="checkbox-grid recipients-grid">
                  {finance_recipients.map((email) => (
                    <label key={email} className="checkbox-pill recipient-pill">
                      <input
                        type="checkbox"
                        checked={selected_recipients.includes(email)}
                        onChange={() => toggle_recipient(email)}
                      />
                      <span>{email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="full">
              Message to finance
              <textarea value={message} onChange={(event) => set_message(event.target.value)} required />
            </label>
            <div className="full text-xs text-muted-foreground">
              Requested by {current_user?.name || "-"} · Replies go to {request_settings.billing_email}
            </div>
            <button className="primary-button" type="submit" disabled={!request_allowed || sending}>
              {sending ? "Sending Request…" : "Request Approval"}
            </button>
          </form>
        </>
      )}

      {can_decide && approval?.status === "pending" && (
        <>
          <div className="panel-subheader">
            <h3>Record Decision</h3>
            <p>Approve to unlock the next stage, or reject with comments for billing to address.</p>
          </div>
          {move_to_live_blocked && (
            <div className="alert warning">
              Approve Move to Live is disabled while {open_finance_issue_count} Finance review issue
              {open_finance_issue_count === 1 ? " remains" : "s remain"} open. Complete each issue above to unlock
              approval, or reject with comments.
            </div>
          )}
          <form className="form-grid" onSubmit={handle_decision}>
            <label>
              Decision
              <select
                value={decision.status}
                onChange={(event) => set_decision((previous) => ({ ...previous, status: event.target.value }))}
              >
                <option value="approved" disabled={move_to_live_blocked}>
                  Approved
                </option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="full">
              Comments
              <textarea
                value={decision.comments}
                onChange={(event) => set_decision((previous) => ({ ...previous, comments: event.target.value }))}
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={deciding || (move_to_live_blocked && decision.status === "approved")}
            >
              {deciding ? "Submitting…" : "Submit Decision"}
            </button>
          </form>
        </>
      )}
    </>
  )
}
