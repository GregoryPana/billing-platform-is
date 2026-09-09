import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "../../lib/icons"

import { api_fetch } from "../../api"
import { show_toast, useDataScope, useAppData } from "../../context/AppDataContext"
import { Button } from "../../components/ui/button"
import { Panel, PanelHeader, PanelTitle, PanelDescription } from "../../components/ui/panel"
import { DataTable, DataTableRow } from "../../components/ui/data-table"
import { EmptyState } from "../../components/ui/empty-state"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { compute_cycle_steps, cycle_month_pair, format_cycle_status, format_month_label } from "../../lib/format"

const current_month_value = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const next_month_value = (usage_month) => {
  if (!usage_month) {
    return ""
  }
  const [year, month] = usage_month.split("-").map(Number)
  if (!year || !month) {
    return ""
  }
  const next = new Date(year, month, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
}

const CYCLES_LIST_SCOPE = ["cycles", "scripts", "runs", "approvals"]

export function CyclesListPage() {
  useDataScope(CYCLES_LIST_SCOPE)
  const { role, cycles, scripts, runs, approvals, reload_all, set_error_message } = useAppData()
  const navigate = useNavigate()
  const can_operate = role === "billing_user" || role === "system_admin"

  const [cycle_form, set_cycle_form] = useState({ usage_month: current_month_value(), notes: "" })
  const [creating, set_creating] = useState(false)

  const handle_cycle_submit = async (event) => {
    event.preventDefault()
    try {
      set_creating(true)
      await api_fetch("/cycles/", { method: "POST", body: JSON.stringify(cycle_form) })
      set_cycle_form({ usage_month: current_month_value(), notes: "" })
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
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Create Cycle</PanelTitle>
              <PanelDescription>Confirm the month being billed. The billing/log month is derived automatically as the month after.</PanelDescription>
            </div>
          </PanelHeader>
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
              Billing month (derived)
              <input type="month" value={next_month_value(cycle_form.usage_month)} readOnly disabled />
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
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>All Cycles</PanelTitle>
            <PanelDescription>Open a cycle to work it through scripts, runs, approvals, and notifications.</PanelDescription>
          </div>
        </PanelHeader>
        <DataTable>
          <DataTableRow head>
            <span>Usage → Billing</span>
            <span>Phase</span>
            <span>Progress</span>
            <span>Created</span>
          </DataTableRow>
          {cycles.length === 0 ? (
            <EmptyState>
              No billing cycles yet. {can_operate ? "Create the first one above." : "Cycles appear here once created."}
            </EmptyState>
          ) : (
            cycles.map((cycle) => {
              const model = compute_cycle_steps(cycle, scripts, runs, approvals)
              return (
                <DataTableRow
                  className="cursor-pointer"
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
                </DataTableRow>
              )
            })
          )}
        </DataTable>
      </Panel>
    </>
  )
}
