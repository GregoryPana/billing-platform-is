import { useCallback, useEffect, useState } from "react"
import { createColumnHelper } from "@tanstack/react-table"

import { useDataScope, useAppData } from "../../context/AppDataContext"
import { cycle_month_pair } from "../../lib/format"
import { get_issue_reporting_summary } from "./reporting-api"
import {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelDescription,
  PanelDetails,
  PanelDetailsSummary,
} from "../../components/ui/panel"
import { SortableTable } from "../../components/ui/sortable-table"

const CONTEXT_LABELS = {
  finance_test_review: "Test-review",
  post_live_observation: "Post-live observation",
}

const cycle_column_helper = createColumnHelper()

const cycle_issue_columns = [
  cycle_column_helper.accessor("usage_month", { id: "usage_month", header: "Cycle" }),
  cycle_column_helper.accessor("billing_month", { id: "billing_month", header: "Billing month" }),
  cycle_column_helper.accessor("count", { id: "count", header: "Open + completed issues" }),
]

const classification_column_helper = createColumnHelper()

const classification_columns = [
  classification_column_helper.accessor("classification", { id: "classification", header: "Classification" }),
  classification_column_helper.accessor("count", { id: "count", header: "Resolved count" }),
]

const context_column_helper = createColumnHelper()

const context_columns = [
  context_column_helper.accessor((row) => CONTEXT_LABELS[row.context] || row.context, {
    id: "context",
    header: "Context",
  }),
  context_column_helper.accessor("count", { id: "count", header: "Count" }),
]

const blocked_column_helper = createColumnHelper()

const blocked_cycle_columns = [
  blocked_column_helper.accessor("usage_month", { id: "usage_month", header: "Cycle" }),
  blocked_column_helper.accessor("billing_month", { id: "billing_month", header: "Billing month" }),
  blocked_column_helper.accessor("blocked_count", { id: "blocked_count", header: "Blocked approval attempts" }),
]

function MetricSection({ title, metric, children }) {
  if (!metric) {
    return null
  }
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>{title}</PanelTitle>
          <PanelDescription>{metric.decision_supported}</PanelDescription>
        </div>
      </PanelHeader>
      {metric.is_empty ? (
        <p className="text-sm text-muted-foreground">No data for the current filters.</p>
      ) : (
        children
      )}
      <PanelDetails>
        <PanelDetailsSummary>How this is calculated</PanelDetailsSummary>
        <p className="text-sm text-muted-foreground">{metric.source}</p>
      </PanelDetails>
    </Panel>
  )
}

/* Finance/Admin-only cycle-quality reporting (Task 8,
   docs/plans/2026-07-21-revenue-protection-issue-control.md). Deliberately
   shows only counts, classifications, and turnaround time - no revenue-at-risk
   or financial values are calculated here per the plan's non-negotiable scope. */
const REPORTING_SCOPE = ["cycles"]

export function BillingIssueReportingPage() {
  useDataScope(REPORTING_SCOPE)
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
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Filters</PanelTitle>
            <PanelDescription>Scope every metric below to a single cycle and/or a billing-month range.</PanelDescription>
          </div>
        </PanelHeader>
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
      </Panel>

      {error ? <div className="alert error">{error}</div> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {metrics && (
        <>
          <MetricSection title="Finance test-review issues per cycle" metric={metrics.test_review_issues_by_cycle}>
            <SortableTable
              columns={cycle_issue_columns}
              data={metrics.test_review_issues_by_cycle.data}
              empty_message="No data for the current filters."
            />
          </MetricSection>

          <MetricSection
            title="Approved classifications (excludes raised-in-error)"
            metric={metrics.classification_breakdown}
          >
            <SortableTable
              columns={classification_columns}
              data={metrics.classification_breakdown.data}
              empty_message="No data for the current filters."
            />
          </MetricSection>

          <MetricSection title="Test-review vs post-live observations" metric={metrics.test_review_vs_post_live}>
            <SortableTable
              columns={context_columns}
              data={metrics.test_review_vs_post_live.data}
              empty_message="No data for the current filters."
            />
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
            <SortableTable
              columns={blocked_cycle_columns}
              data={metrics.cycles_blocked_by_open_issue.data}
              empty_message="No data for the current filters."
            />
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
