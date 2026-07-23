/* Composite status label for a billing issue, combining `status` and
   `completion_outcome` into one accessible label + badge variant, per
   DESIGN_SYSTEM.md's "never convey state by color alone" rule — the
   raised-in-error exclusion is called out in text, not just color. */
export function describe_issue_status(issue) {
  if (issue.status === "open") {
    return { label: "Open", variant: "warning" }
  }
  if (issue.completion_outcome === "raised_in_error") {
    return {
      label: "Completed — Raised in Error",
      variant: "neutral",
      note: "Excluded from headline reporting",
    }
  }
  return { label: "Completed — Resolved", variant: "success" }
}
