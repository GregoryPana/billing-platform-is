import { useMemo, useState } from "react"

import { api_fetch } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { ConfirmDialog } from "../../components/ui/confirm-dialog"
import { cn } from "../../lib/utils"
import {
  format_audit_action_label,
  format_audit_result,
  is_valid_email,
  normalize_email,
  safe_parse_metadata,
} from "../../lib/format"

const empty_user_form = {
  name: "",
  username: "",
  email: "",
  role: "billing_user",
  password: "",
  is_active: true,
}

export function AdministrationPage() {
  const { role } = useAppData()

  const tabs = useMemo(() => {
    const all = [
      { id: "settings", label: "Settings", roles: ["billing_user", "system_admin"] },
      { id: "users", label: "Users", roles: ["system_admin"] },
      { id: "access-requests", label: "Access Requests", roles: ["system_admin"] },
      { id: "audit", label: "Audit Log", roles: ["system_admin"] },
    ]
    return all.filter((tab) => tab.roles.includes(role))
  }, [role])

  const [active_tab, set_active_tab] = useState(tabs[0]?.id || "settings")

  return (
    <>
      {tabs.length > 1 && (
        <div className="mb-6 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Administration sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active_tab === tab.id}
              type="button"
              className={cn(
                "inline-flex h-9 items-center rounded-md border border-transparent px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active_tab === tab.id
                  ? "bg-background text-foreground shadow-sm dark:border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => set_active_tab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {active_tab === "settings" && <SettingsTab />}
      {active_tab === "users" && <UsersTab />}
      {active_tab === "access-requests" && <AccessRequestsTab />}
      {active_tab === "audit" && <AuditTab />}
    </>
  )
}

function SettingsTab() {
  const {
    current_user,
    request_settings,
    set_request_settings,
    finance_recipients,
    set_finance_recipients,
    request_settings_status,
  } = useAppData()
  const [recipient_input, set_recipient_input] = useState("")
  const [recipient_error, set_recipient_error] = useState("")

  const handle_add_recipient = () => {
    const normalized = normalize_email(recipient_input)
    if (!normalized) {
      set_recipient_error("Enter a finance email address to add.")
      return
    }
    if (!is_valid_email(normalized)) {
      set_recipient_error("Enter a valid email address.")
      return
    }
    set_recipient_error("")
    set_finance_recipients((previous) => (previous.includes(normalized) ? previous : [...previous, normalized]))
    set_recipient_input("")
    show_toast("Finance recipient added.", "success")
  }

  const handle_remove_recipient = (email) => {
    set_finance_recipients((previous) => previous.filter((item) => item !== email))
    show_toast("Finance recipient removed.", "info")
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Approval Request Settings</h2>
          <p>
            The finance recipient directory and default message used when requesting approvals. Which recipients
            receive a given request is chosen when you send it, inside the cycle workspace.
          </p>
        </div>
      </div>
      <form className="form-grid" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        <div className="full">
          <p className="helper">Finance recipient directory</p>
          <div className="recipient-row">
            <input
              value={recipient_input}
              onChange={(event) => set_recipient_input(event.target.value)}
              placeholder="finance@example.com"
              name="finance-recipient"
              autoComplete="off"
            />
            <button className="secondary-button" type="button" onClick={handle_add_recipient}>
              Add Recipient
            </button>
          </div>
          {recipient_error ? <div className="alert warning">{recipient_error}</div> : null}
          {finance_recipients.length === 0 ? (
            <div className="empty-state">No recipients yet. Add at least one finance email to enable approval requests.</div>
          ) : (
            <div className="checkbox-grid recipients-grid">
              {finance_recipients.map((email) => (
                <div key={email} className="checkbox-pill recipient-pill">
                  <a href={`mailto:${email}`}>{email}</a>
                  <button className="text-button" type="button" onClick={() => handle_remove_recipient(email)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <label>
          Requester name
          <input value={current_user?.name || ""} disabled placeholder="Name used in approval requests" />
        </label>
        <label>
          Billing department email
          <input value={request_settings.billing_email} disabled autoComplete="email" />
        </label>
        <label className="full">
          Default message
          <textarea
            value={request_settings.default_message}
            onChange={(event) =>
              set_request_settings((previous) => ({ ...previous, default_message: event.target.value }))
            }
            placeholder="Add a default message for approval requests"
          />
        </label>
        {request_settings_status ? <div className="alert info full">{request_settings_status}</div> : null}
      </form>
    </section>
  )
}

function UsersTab() {
  const { users, reload_all, set_error_message } = useAppData()
  const [create_form, set_create_form] = useState(empty_user_form)
  const [edit_user, set_edit_user] = useState(null)
  const [edit_form, set_edit_form] = useState(empty_user_form)
  const [delete_target, set_delete_target] = useState(null)

  const handle_create = async (event) => {
    event.preventDefault()
    try {
      await api_fetch("/users/", { method: "POST", body: JSON.stringify(create_form) })
      set_create_form(empty_user_form)
      show_toast("User created.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not create the user.", "error")
    }
  }

  const handle_update = async (event) => {
    event.preventDefault()
    if (!edit_user) {
      return
    }
    try {
      await api_fetch(`/users/${edit_user.id}`, { method: "PATCH", body: JSON.stringify(edit_form) })
      set_edit_user(null)
      set_edit_form(empty_user_form)
      show_toast("User updated.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not update the user.", "error")
    }
  }

  const handle_delete = async () => {
    const user = delete_target
    set_delete_target(null)
    try {
      await api_fetch(`/users/${user.id}`, { method: "DELETE" })
      show_toast(`User "${user.name}" deleted.`, "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not delete the user.", "error")
    }
  }

  const user_fields = (form, set_form, include_password_label) => (
    <>
      <label>
        Full name
        <input value={form.name} onChange={(event) => set_form((p) => ({ ...p, name: event.target.value }))} required />
      </label>
      <label>
        Username
        <input value={form.username} onChange={(event) => set_form((p) => ({ ...p, username: event.target.value }))} required />
      </label>
      <label>
        Email
        <input
          type="email"
          value={form.email}
          onChange={(event) => set_form((p) => ({ ...p, email: event.target.value }))}
          required
        />
      </label>
      <label>
        Role
        <select value={form.role} onChange={(event) => set_form((p) => ({ ...p, role: event.target.value }))}>
          <option value="billing_user">Billing User</option>
          <option value="finance_user">Finance User</option>
          <option value="system_admin">System Admin</option>
        </select>
      </label>
      <label>
        Status
        <select
          value={form.is_active ? "active" : "inactive"}
          onChange={(event) => set_form((p) => ({ ...p, is_active: event.target.value === "active" }))}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        {include_password_label}
        <input
          type="password"
          value={form.password}
          onChange={(event) => set_form((p) => ({ ...p, password: event.target.value }))}
          required={include_password_label === "Password"}
        />
      </label>
    </>
  )

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Create User</h2>
            <p>Add a user directly without the access-request flow.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handle_create}>
          {user_fields(create_form, set_create_form, "Password")}
          <button className="primary-button" type="submit">
            Create User
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Manage Users</h2>
            <p>Edit user details, roles, and status.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row table-head admin">
            <span>Name</span>
            <span>Username</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {users.map((user) => (
            <div className="data-row admin" key={user.id}>
              <span>{user.name}</span>
              <span>{user.username}</span>
              <span>{user.email}</span>
              <span>{user.role}</span>
              <span>
                <StatusBadge status={user.is_active ? "Active" : "Inactive"} />
              </span>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    set_edit_user(user)
                    set_edit_form({
                      name: user.name,
                      username: user.username,
                      email: user.email,
                      role: user.role,
                      password: "",
                      is_active: user.is_active,
                    })
                  }}
                >
                  Edit
                </button>
                <button
                  className="ghost-button text-destructive hover:bg-destructive/10 hover:text-destructive"
                  type="button"
                  onClick={() => set_delete_target(user)}
                >
                  Delete User
                </button>
              </div>
            </div>
          ))}
        </div>

        {edit_user ? (
          <>
            <div className="panel-subheader">
              <h3>Edit User — {edit_user.name}</h3>
              <p>Leave the password blank to keep the current one.</p>
            </div>
            <form className="form-grid" onSubmit={handle_update}>
              {user_fields(edit_form, set_edit_form, "Reset password")}
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Save Changes
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    set_edit_user(null)
                    set_edit_form(empty_user_form)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(delete_target)}
        title={`Delete user "${delete_target?.name}"?`}
        description="The account will be removed permanently. This cannot be undone."
        confirmLabel="Delete User"
        onConfirm={handle_delete}
        onCancel={() => set_delete_target(null)}
      />
    </>
  )
}

function AccessRequestsTab() {
  const { signup_requests, reload_all, set_error_message } = useAppData()
  const [role_selection, set_role_selection] = useState({})

  const pending = signup_requests.filter((request) => request.status === "pending")
  const handled = signup_requests.filter((request) => request.status !== "pending")

  const handle_approve = async (request_id) => {
    const selected_role = role_selection[request_id] || "billing_user"
    try {
      await api_fetch(`/auth/requests/${request_id}/approve`, {
        method: "POST",
        body: JSON.stringify({ role: selected_role }),
      })
      show_toast("Access request approved.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not approve the request.", "error")
    }
  }

  const handle_reject = async (request_id) => {
    try {
      await api_fetch(`/auth/requests/${request_id}/reject`, { method: "POST" })
      show_toast("Access request rejected.", "info")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not reject the request.", "error")
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Access Requests</h2>
          <p>Approve or reject pending signup requests, assigning a role on approval.</p>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row table-head admin">
          <span>Name</span>
          <span>Username</span>
          <span>Email</span>
          <span>Status</span>
          <span>Role</span>
          <span>Action</span>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">No signup requests pending. New requests appear here for review.</div>
        ) : (
          pending.map((request) => (
            <div className="data-row admin" key={request.id}>
              <span>{request.name}</span>
              <span>{request.username}</span>
              <span>{request.email}</span>
              <span>
                <StatusBadge status={request.status} />
              </span>
              <select
                className="select-inline"
                value={role_selection[request.id] || request.assigned_role || "billing_user"}
                onChange={(event) =>
                  set_role_selection((previous) => ({ ...previous, [request.id]: event.target.value }))
                }
              >
                <option value="billing_user">Billing User</option>
                <option value="finance_user">Finance User</option>
                <option value="system_admin">System Admin</option>
              </select>
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={() => handle_approve(request.id)}>
                  Approve
                </button>
                <button className="ghost-button" type="button" onClick={() => handle_reject(request.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <details className="panel-details">
        <summary>Processed requests ({handled.length})</summary>
        <div className="data-table">
          <div className="data-row table-head admin">
            <span>Name</span>
            <span>Username</span>
            <span>Email</span>
            <span>Status</span>
            <span>Role</span>
            <span />
          </div>
          {handled.length === 0 ? (
            <div className="empty-state">No processed signup requests.</div>
          ) : (
            handled.map((request) => (
              <div className="data-row admin" key={request.id}>
                <span>{request.name}</span>
                <span>{request.username}</span>
                <span>{request.email}</span>
                <span>
                  <StatusBadge status={request.status} />
                </span>
                <span>{request.assigned_role || "-"}</span>
                <span className="muted">-</span>
              </div>
            ))
          )}
        </div>
      </details>
    </section>
  )
}

function AuditTab() {
  const { audit_logs } = useAppData()

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Audit Log</h2>
          <p>Every action recorded for traceability.</p>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row table-head">
          <span>Action</span>
          <span>Entity</span>
          <span>Result</span>
          <span>Timestamp</span>
        </div>
        {audit_logs.length === 0 ? (
          <div className="empty-state">No audit entries recorded yet.</div>
        ) : (
          audit_logs.map((entry) => {
            const metadata = safe_parse_metadata(entry.metadata_json || entry.metadata)
            const result = format_audit_result(entry, metadata)
            return (
              <div className="data-row" key={entry.id}>
                <span className="audit-action">{format_audit_action_label(entry.action, entry.actor_type)}</span>
                <span>{entry.entity_type || metadata.entity_type || "-"}</span>
                <span>
                  <StatusBadge status={result} />
                </span>
                <span>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
