import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, ClipboardList } from "lucide-react"

import { useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  compute_cycle_steps,
  cycle_month_pair,
  format_cycle_status,
  format_stage_label,
} from "../../lib/format"

export function OverviewPage() {
  const { role, cycles, scripts, runs, approvals, notifications, pending_approvals, cycles_by_id, scripts_by_id } =
    useAppData()
  const navigate = useNavigate()

  const status_cards = useMemo(
    () => [
      { label: "Active Cycles", value: `${cycles.length} total`, tone: "neutral" },
      {
        label: "Pending Approvals",
        value: `${pending_approvals.length} awaiting finance`,
        tone: pending_approvals.length ? "warning" : "success",
      },
      { label: "Notifications", value: `${notifications.length} commands`, tone: "info" },
    ],
    [cycles, pending_approvals, notifications]
  )

  const cycle_rows = useMemo(
    () =>
      cycles.map((cycle) => ({
        cycle,
        model: compute_cycle_steps(cycle, scripts, runs, approvals),
      })),
    [cycles, scripts, runs, approvals]
  )
  const in_flight = cycle_rows.filter((row) => row.cycle.status !== "post_live_approved")
  const completed = cycle_rows.filter((row) => row.cycle.status === "post_live_approved")

  const overview_runs = useMemo(() => {
    const status_priority = { failed: 0, planned: 1, executed: 2 }
    return [...runs]
      .sort((first, second) => {
        const first_priority = status_priority[first.status] ?? 3
        const second_priority = status_priority[second.status] ?? 3
        if (first_priority !== second_priority) {
          return first_priority - second_priority
        }
        const first_time = new Date(first.run_timestamp || first.created_at).getTime()
        const second_time = new Date(second.run_timestamp || second.created_at).getTime()
        return second_time - first_time
      })
      .slice(0, 6)
  }, [runs])

  const is_finance = role === "finance_user"
  const can_operate = role === "billing_user" || role === "system_admin"

  return (
    <>
      <section className="grid-cards">
        {status_cards.map((card) => (
          <div className={`status-card ${card.tone}`} key={card.label}>
            <p className="card-label">{card.label}</p>
            <p className="card-value">{card.value}</p>
          </div>
        ))}
      </section>

      {!is_finance && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Cycles in Progress</h2>
              <p>Every open cycle with its workflow progress. Continue takes you to the cycle workspace.</p>
            </div>
            {can_operate ? (
              <Button variant="outline" onClick={() => navigate("/cycles")}>
                All Cycles
              </Button>
            ) : null}
          </div>
          {in_flight.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
              No cycles in progress. {can_operate ? "Create a cycle under Billing Cycles to start a run." : "Cycles will appear here once created."}
            </div>
          ) : (
            <div className="space-y-3">
              {in_flight.map(({ cycle, model }) => (
                <div
                  key={cycle.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-muted p-4"
                >
                  <div className="min-w-[180px]">
                    <p className="text-sm font-medium text-foreground">{cycle_month_pair(cycle)}</p>
                    <p className="text-xs text-muted-foreground">{format_cycle_status(cycle.status)}</p>
                  </div>
                  <div className="flex min-w-[200px] flex-1 items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          model.has_rejection ? "bg-destructive" : model.progress === 100 ? "bg-success" : "bg-warning"
                        )}
                        style={{ width: `${model.progress}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{model.progress}%</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/cycles/${cycle.id}`)}>
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              {completed.length > 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  {completed.length} completed {completed.length === 1 ? "cycle" : "cycles"} — see{" "}
                  <Link className="underline" to="/cycles">
                    Billing Cycles
                  </Link>{" "}
                  for history.
                </p>
              ) : null}
            </div>
          )}
        </section>
      )}

      <section className="content-grid">
        {!is_finance && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Billing Runs</h2>
                <p>Latest execution status updates across all cycles.</p>
              </div>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>Cycle</span>
                <span>Cycle Type</span>
                <span>Script</span>
                <span>Status</span>
                <span>Updated</span>
              </div>
              {overview_runs.length === 0 ? (
                <div className="empty-state">No runs recorded yet. Runs appear once scripts are generated and tracked.</div>
              ) : (
                overview_runs.map((run) => {
                  const script = scripts_by_id.get(String(run.script_definition_id))
                  const cycle = script ? cycles_by_id.get(String(script.billing_cycle_id)) : null
                  return (
                    <div className="table-row" key={run.id}>
                      <span>{cycle ? cycle_month_pair(cycle) : "-"}</span>
                      <span>{script?.log_type || "-"}</span>
                      <span className="capitalize">{script?.script_type || "-"}</span>
                      <span>
                        <StatusBadge status={run.status} />
                      </span>
                      <span>
                        {run.run_timestamp
                          ? new Date(run.run_timestamp).toLocaleString()
                          : new Date(run.created_at).toLocaleString()}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{is_finance ? "Pending Approvals" : "Approvals"}</h2>
              <p>
                {is_finance
                  ? "Requests waiting for your decision."
                  : "Finance checkpoints before advancing the workflow."}
              </p>
            </div>
            {is_finance || role === "system_admin" ? (
              <Button variant="outline" onClick={() => navigate("/approvals")}>
                Open Inbox
              </Button>
            ) : null}
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>Cycle</span>
              <span>Stage</span>
              <span>Status</span>
              <span>Updated</span>
            </div>
            {(is_finance ? pending_approvals : approvals.slice(0, 6)).length === 0 ? (
              <div className="empty-state">
                {is_finance ? "No pending approvals. New requests from billing appear here." : "No approvals recorded yet."}
              </div>
            ) : (
              (is_finance ? pending_approvals : approvals.slice(0, 6)).map((approval) => {
                const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
                return (
                  <div className="table-row" key={approval.id}>
                    <span>{cycle_month_pair(cycle)}</span>
                    <span>{format_stage_label(approval.stage)}</span>
                    <span>
                      <StatusBadge status={approval.status} />
                    </span>
                    <span>{new Date(approval.updated_at).toLocaleString()}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>
    </>
  )
}
