import { api_fetch } from "../../api"

export const get_issue_reporting_summary = ({ billing_cycle_id, start_month, end_month } = {}) => {
  const params = new URLSearchParams()
  if (billing_cycle_id) {
    params.set("billing_cycle_id", billing_cycle_id)
  }
  if (start_month) {
    params.set("start_month", start_month)
  }
  if (end_month) {
    params.set("end_month", end_month)
  }
  const query = params.toString()
  return api_fetch(`/issue-reporting/summary${query ? `?${query}` : ""}`)
}
