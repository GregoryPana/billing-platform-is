import { useEffect, useState } from "react"

import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog } from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import { Select } from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import { show_toast } from "../../context/AppDataContext"
import { add_issue_comment, complete_issue, edit_issue, get_issue_activities, reopen_issue } from "./issue-api"
import { describe_issue_status } from "./issue-status"

const activity_labels = {
  created: "Logged",
  comment: "Comment",
  edited: "Edited",
  completed: "Completed",
  reopened: "Reopened",
}

/* Issue detail + append-only activity timeline, with Finance/Admin-only
   inline actions (one active at a time, per DESIGN_SYSTEM's "one clear
   primary action" rule). Billing sees the same timeline read-only. */
export function IssueActivityDialog({
  open,
  onOpenChange,
  issue,
  classification_name,
  can_manage,
  test_approved,
  on_changed,
}) {
  const [activities, set_activities] = useState([])
  const [loading, set_loading] = useState(false)
  const [action, set_action] = useState(null)
  const [comment_text, set_comment_text] = useState("")
  const [edit_title, set_edit_title] = useState("")
  const [edit_detail, set_edit_detail] = useState("")
  const [edit_comment, set_edit_comment] = useState("")
  const [complete_outcome, set_complete_outcome] = useState("resolved")
  const [complete_comment, set_complete_comment] = useState("")
  const [reopen_comment, set_reopen_comment] = useState("")
  const [submitting, set_submitting] = useState(false)

  const load_activities = async (issue_id) => {
    try {
      set_loading(true)
      const data = await get_issue_activities(issue_id)
      set_activities(data)
    } catch (error) {
      show_toast(error.message || "Failed to load issue activity.", "error")
    } finally {
      set_loading(false)
    }
  }

  useEffect(() => {
    if (open && issue) {
      set_action(null)
      set_comment_text("")
      set_edit_title(issue.title)
      set_edit_detail(issue.detail)
      set_edit_comment("")
      set_complete_outcome("resolved")
      set_complete_comment("")
      set_reopen_comment("")
      load_activities(issue.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, issue?.id])

  if (!issue) {
    return null
  }

  const status = describe_issue_status(issue)
  const can_complete = can_manage && issue.status === "open"
  const can_reopen =
    can_manage && issue.status === "completed" && issue.context === "finance_test_review" && !test_approved

  const after_mutation = async () => {
    set_action(null)
    await load_activities(issue.id)
    await on_changed?.()
  }

  const handle_comment = async (event) => {
    event.preventDefault()
    if (!comment_text.trim()) {
      show_toast("Enter a comment first.", "error")
      return
    }
    try {
      set_submitting(true)
      await add_issue_comment(issue.id, comment_text)
      show_toast("Comment added.", "success")
      await after_mutation()
    } catch (error) {
      show_toast(error.message || "Failed to add comment.", "error")
    } finally {
      set_submitting(false)
    }
  }

  const handle_edit = async (event) => {
    event.preventDefault()
    if (!edit_comment.trim()) {
      show_toast("An edit comment is required.", "error")
      return
    }
    try {
      set_submitting(true)
      await edit_issue(issue.id, { title: edit_title, detail: edit_detail, comment: edit_comment })
      show_toast("Issue updated.", "success")
      await after_mutation()
    } catch (error) {
      show_toast(error.message || "Failed to update the issue.", "error")
    } finally {
      set_submitting(false)
    }
  }

  const handle_complete = async (event) => {
    event.preventDefault()
    if (complete_outcome === "raised_in_error" && !complete_comment.trim()) {
      show_toast("A comment is required when marking an issue Raised in Error.", "error")
      return
    }
    try {
      set_submitting(true)
      await complete_issue(issue.id, {
        outcome: complete_outcome,
        comment: complete_comment.trim() ? complete_comment : undefined,
      })
      show_toast("Issue completed.", "success")
      await after_mutation()
    } catch (error) {
      show_toast(error.message || "Failed to complete the issue.", "error")
    } finally {
      set_submitting(false)
    }
  }

  const handle_reopen = async (event) => {
    event.preventDefault()
    if (!reopen_comment.trim()) {
      show_toast("A comment is required to reopen an issue.", "error")
      return
    }
    try {
      set_submitting(true)
      await reopen_issue(issue.id, reopen_comment)
      show_toast("Issue reopened.", "success")
      await after_mutation()
    } catch (error) {
      show_toast(error.message || "Failed to reopen the issue.", "error")
    } finally {
      set_submitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={issue.title} description={classification_name}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        {status.note ? <span className="text-xs text-muted-foreground">{status.note}</span> : null}
      </div>

      <div className="detail-card mx-0 mb-4">
        <strong>Finding</strong>
        <p>{issue.detail}</p>
      </div>

      {issue.status === "completed" && (
        <div className="detail-card mx-0 mb-4">
          <strong>Completion</strong>
          <p>{issue.completion_comment || "No completion comment recorded."}</p>
        </div>
      )}

      <div className="panel-subheader mt-0">
        <h3>Activity</h3>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="mb-4 flex list-none flex-col gap-3 p-0">
          {activities.map((activity) => (
            <li key={activity.id} className="rounded-md bg-muted p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {activity_labels[activity.activity_type] || activity.activity_type}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</span>
              </div>
              {activity.comment ? <p className="m-0 text-foreground">{activity.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {!can_manage && (
        <p className="text-xs text-muted-foreground">Finance confirms completion and controls movement to Live.</p>
      )}

      {can_manage && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set_action(action === "comment" ? null : "comment")}
            >
              Add Comment
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => set_action(action === "edit" ? null : "edit")}>
              Edit
            </Button>
            {can_complete && (
              <Button type="button" size="sm" onClick={() => set_action(action === "complete" ? null : "complete")}>
                Complete
              </Button>
            )}
            {can_reopen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set_action(action === "reopen" ? null : "reopen")}
              >
                Reopen
              </Button>
            )}
          </div>

          {action === "comment" && (
            <form className="form-grid mt-4" onSubmit={handle_comment}>
              <label className="full">
                Comment
                <Textarea value={comment_text} onChange={(event) => set_comment_text(event.target.value)} rows={3} required />
              </label>
              <div className="form-actions full">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Add Comment"}
                </Button>
              </div>
            </form>
          )}

          {action === "edit" && (
            <form className="form-grid mt-4" onSubmit={handle_edit}>
              <label className="full">
                Title
                <Input value={edit_title} onChange={(event) => set_edit_title(event.target.value)} required />
              </label>
              <label className="full">
                Detail
                <Textarea value={edit_detail} onChange={(event) => set_edit_detail(event.target.value)} rows={3} required />
              </label>
              <label className="full">
                Edit comment (required)
                <Textarea value={edit_comment} onChange={(event) => set_edit_comment(event.target.value)} rows={2} required />
              </label>
              <div className="form-actions full">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          )}

          {action === "complete" && (
            <form className="form-grid mt-4" onSubmit={handle_complete}>
              <label className="full">
                Outcome
                <Select value={complete_outcome} onChange={(event) => set_complete_outcome(event.target.value)}>
                  <option value="resolved">Resolved</option>
                  <option value="raised_in_error">Raised in Error</option>
                </Select>
              </label>
              <label className="full">
                Comment {complete_outcome === "raised_in_error" ? "(required)" : "(optional)"}
                <Textarea
                  value={complete_comment}
                  onChange={(event) => set_complete_comment(event.target.value)}
                  rows={3}
                  required={complete_outcome === "raised_in_error"}
                />
              </label>
              <div className="form-actions full">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Mark Completed"}
                </Button>
              </div>
            </form>
          )}

          {action === "reopen" && (
            <form className="form-grid mt-4" onSubmit={handle_reopen}>
              <label className="full">
                Reopen comment (required)
                <Textarea value={reopen_comment} onChange={(event) => set_reopen_comment(event.target.value)} rows={3} required />
              </label>
              <div className="form-actions full">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Reopening…" : "Reopen Issue"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Dialog>
  )
}
