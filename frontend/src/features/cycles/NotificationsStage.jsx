import { useMemo, useState } from "react"

import { api_fetch } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { cycle_month_pair, download_text_file, format_input_date } from "../../lib/format"

export function NotificationsStage({ cycle, blocked }) {
  const { role, notifications, reload_all, set_error_message } = useAppData()
  const can_operate = role === "billing_user" || role === "system_admin"

  const [notification_date, set_notification_date] = useState(format_input_date())
  const [generating, set_generating] = useState(false)
  const [last_command, set_last_command] = useState(null)

  const cycle_notifications = useMemo(
    () => notifications.filter((item) => String(item.billing_cycle_id) === String(cycle.id)),
    [notifications, cycle]
  )

  const handle_submit = async (event) => {
    event.preventDefault()
    try {
      set_generating(true)
      const response = await api_fetch("/notifications/", {
        method: "POST",
        body: JSON.stringify({ billing_cycle_id: String(cycle.id), notification_date }),
      })
      set_last_command({ message: response.message, notification_date })
      show_toast("Notification command generated.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not generate the notification command.", "error")
    } finally {
      set_generating(false)
    }
  }

  if (blocked) {
    return <div className="alert warning">Post-live approval is required before generating notification commands.</div>
  }

  return (
    <>
      <div className="notification-guide">
        <div className="notification-block">
          <h4>Email Notifications</h4>
          <p>
            Run the email notification script for the selected date. This triggers the standard Streamserve email
            notification flow for real billing.
          </p>
          <p className="helper">Email notifications command</p>
          <pre className="command-block mono">/cer_cerprod/Dominique/EMAIL_NOTIFICATION_FOR_REAL_BILL_FINAL.sh</pre>
        </div>
        <div className="notification-block">
          <h4>SMS Notifications</h4>
          <p>
            Run the SMS notification script for the selected date. This sends SMS notifications for the completed real
            billing cycle.
          </p>
          <p className="helper">SMS notifications command</p>
          <pre className="command-block mono">/cer_cerprod/Dominique/SMS_NOTIFICATION_FOR_REAL_BILL.sh</pre>
        </div>
      </div>

      {can_operate && (
        <form className="form-grid" onSubmit={handle_submit}>
          <label>
            Notification date
            <input
              type="date"
              value={notification_date}
              onChange={(event) => set_notification_date(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={!notification_date || generating}>
            {generating ? "Generating…" : "Generate Command"}
          </button>
        </form>
      )}

      {last_command ? (
        <div className="notification-download">
          <div>
            <p className="helper">Latest generated commands</p>
            <pre className="command-block mono">{last_command.message}</pre>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const cycle_label = cycle_month_pair(cycle)
              const filename = `notifications_${cycle_label.replace(/\s+/g, "_")}_${last_command.notification_date}.txt`
              const content = [
                "Billing Notifications Commands",
                "================================",
                `Billing cycle: ${cycle_label}`,
                `Notification date: ${last_command.notification_date}`,
                "",
                last_command.message,
              ].join("\n")
              download_text_file(filename, content)
            }}
          >
            Download Commands
          </button>
        </div>
      ) : null}

      <div className="panel-subheader">
        <h3>Notification History</h3>
        <p>Commands generated for this cycle.</p>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>Command</span>
          <span>Status</span>
          <span>Created</span>
          <span />
        </div>
        {cycle_notifications.length === 0 ? (
          <div className="empty-state">No notification commands generated for this cycle yet.</div>
        ) : (
          cycle_notifications.map((notification) => (
            <div className="table-row" key={notification.id}>
              <span>
                <pre className="command-block mono">{notification.message}</pre>
              </span>
              <span>
                <StatusBadge status={notification.status} />
              </span>
              <span>{notification.created_at ? new Date(notification.created_at).toLocaleString() : "-"}</span>
              <span />
            </div>
          ))
        )}
      </div>
    </>
  )
}
