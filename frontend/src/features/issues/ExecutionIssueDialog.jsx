import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import { Dialog } from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import { Select } from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import { show_toast } from "../../context/AppDataContext"
import { create_issue, list_issue_classifications } from "./issue-api"

/* Rare operational evidence against a single script run
   (docs/FINANCE_ISSUE_CONTROL_DESIGN.md section 3.1). Create-only: the run's
   own status (planned/executed/failed) remains the sole readiness signal, so
   there is no completion/reopen lifecycle here, unlike Finance issues. */
export function ExecutionIssueDialog({ open, onOpenChange, cycle_id, run_id, run_label, on_created }) {
  const [classifications, set_classifications] = useState([])
  const [classification_id, set_classification_id] = useState("")
  const [title, set_title] = useState("")
  const [detail, set_detail] = useState("")
  const [loading, set_loading] = useState(false)
  const [submitting, set_submitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    set_title("")
    set_detail("")
    set_loading(true)
    list_issue_classifications("execution_issue")
      .then((data) => {
        set_classifications(data)
        set_classification_id(data[0]?.id || "")
      })
      .catch((error) => show_toast(error.message || "Failed to load classifications.", "error"))
      .finally(() => set_loading(false))
  }, [open])

  const selected_classification = classifications.find((item) => item.id === classification_id)
  const is_other = selected_classification?.name === "Other"

  const handle_submit = async (event) => {
    event.preventDefault()
    if (is_other && !detail.trim()) {
      show_toast("Detail is required for the Other classification.", "error")
      return
    }
    try {
      set_submitting(true)
      const issue = await create_issue({
        billing_cycle_id: cycle_id,
        context: "execution_issue",
        related_script_run_id: run_id,
        classification_id,
        title,
        detail,
      })
      show_toast("Execution issue logged.", "success")
      onOpenChange(false)
      await on_created?.(issue)
    } catch (error) {
      show_toast(error.message || "Failed to log the execution issue.", "error")
    } finally {
      set_submitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log Execution Issue"
      description={`Record rare operational context for ${run_label || "this run"}. This does not change the run's readiness status.`}
    >
      <form className="form-grid" onSubmit={handle_submit}>
        <label className="full">
          Classification
          <Select
            value={classification_id}
            onChange={(event) => set_classification_id(event.target.value)}
            disabled={loading}
            required
          >
            {classifications.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="full">
          Title
          <Input value={title} onChange={(event) => set_title(event.target.value)} maxLength={255} required />
        </label>
        <label className="full">
          Detail{is_other ? " (required — please explain)" : ""}
          <Textarea value={detail} onChange={(event) => set_detail(event.target.value)} rows={4} required />
        </label>
        <div className="form-actions full">
          <Button type="submit" disabled={submitting || loading || !classification_id}>
            {submitting ? "Logging…" : "Log Issue"}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
