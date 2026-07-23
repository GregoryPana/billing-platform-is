import { Play, Shield } from "lucide-react"

import { cn } from "../../lib/utils"
import { compute_cycle_steps, cycle_month_pair } from "../../lib/format"

export function CycleProgressTracker({ cycle, scripts = [], runs = [], approvals = [] }) {
  const model = compute_cycle_steps(cycle, scripts, runs, approvals)
  if (!model) {
    return null
  }
  const { steps, progress, completed_steps, has_rejection } = model
  const connector_progress = Math.max(0, Math.min(100, ((completed_steps - 1) / (steps.length - 1)) * 100))
  const is_complete = progress === 100
  const progress_bar_tone = has_rejection ? "danger" : is_complete ? "success" : "warning"

  return (
    <div
      className={cn(
        "mb-8 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm border-l-4",
        progress_bar_tone === "danger"
          ? "border-l-destructive"
          : progress_bar_tone === "success"
          ? "border-l-success"
          : "border-l-warning"
      )}
    >
      <div className="border-b bg-muted/30 px-6 py-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-1 text-xl font-semibold tracking-tight">{cycle_month_pair(cycle)}</h2>
            <p className="text-sm text-muted-foreground">Workflow progression for local billing cycle</p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                "text-2xl font-semibold tabular-nums",
                progress_bar_tone === "danger"
                  ? "text-destructive"
                  : progress_bar_tone === "success"
                  ? "text-success"
                  : "text-foreground"
              )}
            >
              {progress}%
            </span>
            <p className="text-xs text-muted-foreground">Complete</p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-in-out",
              progress_bar_tone === "danger"
                ? "bg-destructive"
                : progress_bar_tone === "success"
                ? "bg-success"
                : "bg-warning"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="relative px-6 py-5">
        <div className="absolute left-8 right-8 top-[2.2rem] hidden h-px bg-border md:block" />
        <div
          className={cn(
            "absolute left-8 top-[2.2rem] hidden h-px transition-all duration-300 md:block",
            progress_bar_tone === "danger"
              ? "bg-destructive"
              : progress_bar_tone === "success"
              ? "bg-success"
              : "bg-warning"
          )}
          style={{ width: `calc((100% - 5rem) * ${connector_progress / 100})` }}
        />

        <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          {steps.map((step, i) => {
            const is_current = i === completed_steps && !step.done && !step.rejected

            return (
              <div key={i} className="relative z-10 flex flex-col items-center gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md border bg-card text-sm font-semibold transition-colors duration-200",
                    step.rejected
                      ? "border-destructive/50 text-destructive"
                      : step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : is_current
                      ? "border-warning bg-warning/15 text-warning-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {step.rejected ? <Shield size={15} /> : step.done ? <Play size={14} fill="currentColor" /> : <span>{i + 1}</span>}
                </div>

                <p
                  className={cn(
                    "max-w-[96px] text-center text-xs font-medium leading-4",
                    step.rejected
                      ? "text-destructive"
                      : step.done || is_current
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
