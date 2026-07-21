import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Lock } from "lucide-react"

import { useAppData } from "../../context/AppDataContext"
import { CycleProgressTracker } from "../../components/billing/CycleProgressTracker"
import { cn } from "../../lib/utils"
import { compute_stage_ready, cycle_month_pair, format_cycle_status, format_stage_label } from "../../lib/format"
import { ScriptsRunsStage } from "./ScriptsRunsStage"
import { ApprovalStage } from "./ApprovalStage"
import { NotificationsStage } from "./NotificationsStage"

const stage_descriptions = {
  details: "Cycle metadata and notes.",
  test: "Generate test scripts and track their execution.",
  "test-approval": "Finance sign-off required before live scripts can be generated.",
  live: "Generate live scripts and track their execution. Unlocked by test approval.",
  "post-live-approval": "Finance sign-off required before customer notifications go out.",
  notifications: "Generate the email and SMS notification commands. Unlocked by post-live approval.",
}

export function CycleWorkspacePage() {
  const { cycle_id } = useParams()
  const { cycles_by_id, scripts, runs, approvals, runs_by_script_id, approvals_by_cycle_stage } = useAppData()

  const cycle = cycles_by_id.get(String(cycle_id))

  const test_approved = approvals_by_cycle_stage.get(`${cycle_id}:test`)?.status === "approved"
  const post_live_approved = approvals_by_cycle_stage.get(`${cycle_id}:post_live`)?.status === "approved"

  const stages = useMemo(
    () => [
      { id: "details", label: "Details" },
      { id: "test", label: "Test Scripts & Runs" },
      { id: "test-approval", label: "Test Approval" },
      { id: "live", label: "Live Scripts & Runs", locked: !test_approved, locked_reason: "Requires test approval" },
      {
        id: "post-live-approval",
        label: "Post-Live Approval",
        locked: !test_approved,
        locked_reason: "Requires test approval",
      },
      {
        id: "notifications",
        label: "Notifications",
        locked: !post_live_approved,
        locked_reason: "Requires post-live approval",
      },
    ],
    [test_approved, post_live_approved]
  )

  /* Land the user on the stage the cycle is actually at. */
  const default_stage = useMemo(() => {
    if (!cycle) {
      return "details"
    }
    if (post_live_approved) {
      return "notifications"
    }
    if (test_approved) {
      const live_ready = compute_stage_ready(cycle.id, "live", scripts, runs_by_script_id)
      return live_ready ? "post-live-approval" : "live"
    }
    const test_ready = compute_stage_ready(cycle.id, "test", scripts, runs_by_script_id)
    return test_ready ? "test-approval" : "test"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle_id])

  const [active_stage, set_active_stage] = useState(default_stage)

  if (!cycle) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Cycle Not Found</h2>
            <p>This cycle may have been removed, or the data is still loading.</p>
          </div>
        </div>
        <Link className="secondary-button" to="/cycles">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Billing Cycles
        </Link>
      </section>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          to="/cycles"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All Cycles
        </Link>
        <span className="text-sm text-muted-foreground">
          {cycle_month_pair(cycle)} · {format_cycle_status(cycle.status)}
        </span>
      </div>

      <CycleProgressTracker cycle={cycle} scripts={scripts} runs={runs} approvals={approvals} />

      <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Cycle stages">
        {stages.map((stage) => (
          <button
            key={stage.id}
            role="tab"
            aria-selected={active_stage === stage.id}
            type="button"
            disabled={stage.locked}
            title={stage.locked ? stage.locked_reason : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active_stage === stage.id
                ? "bg-background text-foreground shadow-sm dark:border-border"
                : stage.locked
                ? "cursor-not-allowed text-muted-foreground opacity-60"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => !stage.locked && set_active_stage(stage.id)}
          >
            {stage.locked && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
            {stage.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{stages.find((stage) => stage.id === active_stage)?.label}</h2>
            <p>{stage_descriptions[active_stage]}</p>
          </div>
        </div>

        {active_stage === "details" && (
          <div className="summary-card">
            <div>
              <span className="label">Usage month</span>
              <span>{cycle.usage_month}</span>
            </div>
            <div>
              <span className="label">Billing month</span>
              <span>{cycle.billing_month}</span>
            </div>
            <div>
              <span className="label">Phase</span>
              <span>{format_cycle_status(cycle.status)}</span>
            </div>
            <div>
              <span className="label">Created</span>
              <span>{new Date(cycle.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="label">Notes</span>
              <span>{cycle.notes || "-"}</span>
            </div>
          </div>
        )}

        {active_stage === "test" && <ScriptsRunsStage cycle={cycle} environment="test" />}

        {active_stage === "test-approval" && <ApprovalStage cycle={cycle} stage="test" />}

        {active_stage === "live" && (
          <ScriptsRunsStage
            cycle={cycle}
            environment="live"
            blocked={!test_approved}
            blocked_reason={`Test approval (${format_stage_label("test")}) is required before generating live scripts.`}
          />
        )}

        {active_stage === "post-live-approval" && <ApprovalStage cycle={cycle} stage="post_live" />}

        {active_stage === "notifications" && <NotificationsStage cycle={cycle} blocked={!post_live_approved} />}
      </section>
    </>
  )
}
