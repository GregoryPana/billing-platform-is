import { useCallback, useEffect, useState } from "react"

import { useAppData } from "../../context/AppDataContext"
import { cycle_month_pair } from "../../lib/format"
import { get_issue_reporting_summary } from "./reporting-api"

const CONTEXT_LABELS = {
  finance_test_review: "Test-review",
  post_live_observation: "Post-live observation",
}

function MetricSection({ title, metric, children }) {
  if (!metric) {
    return null
  }
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{metric.decision_supported}</p>
        </div>
      </div>
      <div className="summary-card mb-4">
        <div>
          <span className="label">Source</span>
          <span>{metric.source}</span>
        </div>
        <div>
          <span className="label">Filter scope</span>
          <span>{metric.filter_scope}</span>
        </div>
      </div>
      {metric.is_empty ? (
        <p className="text-sm text-muted-foreground">No data for the current filters.</p>
      ) : (
        children
      )}
    </section>
  )
}

/* Finance/Admin-only cycle-quality reporting (Task 8,
   docs/plans/2026-07-21-revenue-protection-issue-control.md). Deliberately
   shows only counts, classifications, and turnaround time - no revenue-at-risk
   or financial values are calculated here per the plan's non-negotiable scope. */
export function BillingIssueReportingPage() {
  const { cycles } = useAppData()

  const [billing_cycle_id, set_billing_cycle_id] = useState("")
  const [start_month, set_start_month] = useState("")
  const [end_month, set_end_month] = useState("")
  const [summary, set_summary] = useState(null)
  const [loading, set_loading] = useState(true)
  const [error, set_error] = useState("")

  const reload = useCallback(async () => {
    try {
      set_loading(true)
      set_error("")
      const data = await get_issue_reporting_summary({
        billing_cycle_id: billing_cycle_id || undefined,
        start_month: start_month || undefined,
        end_month: end_month || undefined,
      })
      set_summary(data)
    } catch (err) {
      set_error(err.message || "Failed to load issue reporting summary.")
    } finally {
      set_loading(false)
    }
  }, [billing_cycle_id, start_month, end_month])

  useEffect(() => {
    reload()
  }, [reload])

  const metrics = summary?.metrics

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Filters</h2>
            <p>Scope every metric below to a single cycle and/or a billing-month range.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Billing cycle
            <select
              value={billing_cycle_id}
              onChange={(event) => set_billing_cycle_id(event.target.value)}
            >
              <option value="">All cycles</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle_month_pair(cycle)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Billing month from
            <input type="month" value={start_month} onChange={(event) => set_start_month(event.target.value)} />
          </label>
          <label>
            Billing month to
            <input type="month" value={end_month} onChange={(event) => set_end_month(event.target.value)} />
          </label>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {metrics && (
        <>
          <MetricSection title="Finance test-review issues per cycle" metric={metrics.test_review_issues_by_cycle}>
            <div className="data-table">
              <div className="data-row table-head">
                <span>Cycle</span>
                <span>Billing month</span>
                <span>Open + completed issues</span>
              </div>
              {metrics.test_review_issues_by_cycle.data.map((row) => (
                <div className="data-row" key={row.billing_cycle_id}>
                  <span>{row.usage_month}</span>
                  <span>{row.billing_month}</span>
                  <span>{row.count}</span>
                </div>
              ))}
            </div>
          </MetricSection>

          <MetricSection
            title="Approved classifications (excludes raised-in-error)"
            metric={metrics.classification_breakdown}
          >
            <div className="data-table">
              <div className="data-row table-head">
                <span>Classification</span>
                <span>Resolved count</span>
              </div>
              {metrics.classification_breakdown.data.map((row) => (
                <div className="data-row" key={row.classification}>
                  <span>{row.classification}</span>
                  <span>{row.count}</span>
                </div>
              ))}
            </div>
          </MetricSection>

          <MetricSection title="Test-review vs post-live observations" metric={metrics.test_review_vs_post_live}>
            <div className="data-table">
              <div className="data-row table-head">
                <span>Context</span>
                <span>Count</span>
              </div>
              {metrics.test_review_vs_post_live.data.map((row) => (
                <div className="data-row" key={row.context}>
                  <span>{CONTEXT_LABELS[row.context] || row.context}</span>
                  <span>{row.count}</span>
                </div>
              ))}
            </div>
          </MetricSection>

          <MetricSection title="Time to Finance completion" metric={metrics.completion_turnaround}>
            <div className="summary-card">
              <div>
                <span className="label">Average</span>
                <span>{metrics.completion_turnaround.data.average_hours} hours</span>
              </div>
              <div>
                <span className="label">Median</span>
                <span>{metrics.completion_turnaround.data.median_hours} hours</span>
              </div>
              <div>
                <span className="label">Sample size</span>
                <span>{metrics.completion_turnaround.data.sample_size} completed issues</span>
              </div>
            </div>
          </MetricSection>

          <MetricSection
            title="Cycles blocked by an open issue"
            metric={metrics.cycles_blocked_by_open_issue}
          >
            <div className="data-table">
              <div className="data-row table-head">
                <span>Cycle</span>
                <span>Billing month</span>
                <span>Blocked approval attempts</span>
              </div>
              {metrics.cycles_blocked_by_open_issue.data.map((row) => (
                <div className="data-row" key={row.billing_cycle_id}>
                  <span>{row.usage_month}</span>
                  <span>{row.billing_month}</span>
                  <span>{row.blocked_count}</span>
                </div>
              ))}
            </div>
          </MetricSection>

          <MetricSection title="Raised-in-error (audit-quality measure)" metric={metrics.raised_in_error}>
            <div className="summary-card">
              <div>
                <span className="label">Count</span>
                <span>{metrics.raised_in_error.data.count}</span>
              </div>
              <div>
                <span className="label">% of completed Finance issues</span>
                <span>{metrics.raised_in_error.data.percentage_of_completed}%</span>
              </div>
            </div>
          </MetricSection>
        </>
      )}
    </>
  )
}
