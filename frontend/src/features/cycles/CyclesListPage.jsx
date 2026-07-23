import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { api_fetch } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { Button } from "../../components/ui/button"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { compute_cycle_steps, cycle_month_pair, format_cycle_status, format_month_label } from "../../lib/format"

export function CyclesListPage() {
  const { role, cycles, scripts, runs, approvals, reload_all, set_error_message } = useAppData()
  const navigate = useNavigate()
  const can_operate = role === "billing_user" || role === "system_admin"

  const [cycle_form, set_cycle_form] = useState({ usage_month: "", billing_month: "", notes: "" })
  const [creating, set_creating] = useState(false)

  const handle_cycle_submit = async (event) => {
    event.preventDefault()
    try {
      set_creating(true)
      await api_fetch("/cycles/", { method: "POST", body: JSON.stringify(cycle_form) })
      set_cycle_form({ usage_month: "", billing_month: "", notes: "" })
      show_toast("Billing cycle created.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not create the billing cycle.", "error")
    } finally {
      set_creating(false)
    }
  }

  return (
    <>
      {can_operate && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Create Cycle</h2>
              <p>Pair a usage month with the billing month it will be invoiced in.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handle_cycle_submit}>
            <label>
              Usage month
              <input
                type="month"
                value={cycle_form.usage_month}
                onChange={(event) => set_cycle_form((previous) => ({ ...previous, usage_month: event.target.value }))}
                required
              />
            </label>
            <label>
              Billing month
              <input
                type="month"
                value={cycle_form.billing_month}
                onChange={(event) => set_cycle_form((previous) => ({ ...previous, billing_month: event.target.value }))}
                required
              />
            </label>
            <label className="full">
              Notes
              <textarea
                value={cycle_form.notes}
                onChange={(event) => set_cycle_form((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </label>
            <button className="primary-button" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create Cycle"}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>All Cycles</h2>
            <p>Open a cycle to work it through scripts, runs, approvals, and notifications.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row table-head">
            <span>Usage → Billing</span>
            <span>Phase</span>
            <span>Progress</span>
            <span>Created</span>
          </div>
          {cycles.length === 0 ? (
            <div className="empty-state">
              No billing cycles yet. {can_operate ? "Create the first one above." : "Cycles appear here once created."}
            </div>
          ) : (
            cycles.map((cycle) => {
              const model = compute_cycle_steps(cycle, scripts, runs, approvals)
              return (
                <div
                  className="data-row cursor-pointer"
                  key={cycle.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/cycles/${cycle.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      navigate(`/cycles/${cycle.id}`)
                    }
                  }}
                >
                  <span className="font-medium">{cycle_month_pair(cycle)}</span>
                  <span>
                    <StatusBadge status={format_cycle_status(cycle.status)} />
                  </span>
                  <span className="tabular-nums">{model.progress}%</span>
                  <span className="flex items-center justify-between gap-2">
                    {new Date(cycle.created_at).toLocaleDateString()}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Open cycle ${format_month_label(cycle.usage_month)}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/cycles/${cycle.id}`)
                      }}
                    >
                      Open
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>
    </>
  )
}
