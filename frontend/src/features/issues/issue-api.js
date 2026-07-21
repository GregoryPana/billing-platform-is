import { api_fetch } from "../../api"

export const list_finance_issues = (billing_cycle_id, context) => {
  const params = new URLSearchParams({ billing_cycle_id: String(billing_cycle_id) })
  if (context) {
    params.set("context", context)
  }
  return api_fetch(`/issues/?${params.toString()}`)
}

export const list_issue_classifications = (context = "finance_review") =>
  api_fetch(`/issues/classifications?context=${encodeURIComponent(context)}`)

export const create_issue = (payload) => api_fetch("/issues/", { method: "POST", body: JSON.stringify(payload) })

export const get_issue_activities = (issue_id) => api_fetch(`/issues/${issue_id}/activities`)

export const add_issue_comment = (issue_id, comment) =>
  api_fetch(`/issues/${issue_id}/activities`, { method: "POST", body: JSON.stringify({ comment }) })

export const edit_issue = (issue_id, payload) =>
  api_fetch(`/issues/${issue_id}`, { method: "PATCH", body: JSON.stringify(payload) })

export const complete_issue = (issue_id, payload) =>
  api_fetch(`/issues/${issue_id}/complete`, { method: "POST", body: JSON.stringify(payload) })

export const reopen_issue = (issue_id, comment) =>
  api_fetch(`/issues/${issue_id}/reopen`, { method: "POST", body: JSON.stringify({ comment }) })
