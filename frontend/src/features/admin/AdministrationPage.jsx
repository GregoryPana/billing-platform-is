import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createColumnHelper } from "@tanstack/react-table"

import { api_fetch } from "../../api"
import { show_toast, useDataScope, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { ConfirmDialog } from "../../components/ui/confirm-dialog"
import { Panel, PanelHeader, PanelTitle, PanelDescription, PanelSubheader, PanelSubheaderTitle, PanelSubheaderDescription } from "../../components/ui/panel"
import { DataTable, DataTableRow } from "../../components/ui/data-table"
import { SortableTable } from "../../components/ui/sortable-table"
import { EmptyState } from "../../components/ui/empty-state"
import { cn } from "../../lib/utils"
import {
  format_audit_action_label,
  format_audit_result,
  is_valid_email,
  normalize_email,
  safe_parse_metadata,
} from "../../lib/format"

/* Mirrors backend/app/schemas/users.py UserUpdate - all fields are optional
   server-side, so client requiredness here only matches what the existing
   `required` inputs already enforced (name/username/email non-empty). Email
   format reuses lib/format.js's is_valid_email pattern for consistency. */
const user_edit_schema = z.object({
  name: z.string().trim().min(1, "Full name is required."),
  username: z.string().trim().min(1, "Username is required."),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .refine((value) => is_valid_email(value), "Enter a valid email address."),
  status: z.enum(["active", "inactive"]),
  password: z.string(),
})

export function AdministrationPage() {
  const { role } = useAppData()

  const tabs = useMemo(() => {
    const all = [
      { id: "settings", label: "Settings", roles: ["billing_user", "system_admin"] },
      { id: "users", label: "Users", roles: ["system_admin"] },
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
                "inline-flex h-11 items-center rounded-md border border-transparent px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10",
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
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Approval Request Settings</PanelTitle>
          <PanelDescription>
            The finance recipient directory and default message used when requesting approvals. Which recipients
            receive a given request is chosen when you send it, inside the cycle workspace.
          </PanelDescription>
        </div>
      </PanelHeader>
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
            <EmptyState>No recipients yet. Add at least one finance email to enable approval requests.</EmptyState>
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
    </Panel>
  )
}

const USERS_SCOPE = ["users"]

function UsersTab() {
  useDataScope(USERS_SCOPE)
  const { users, reload_all, set_error_message } = useAppData()
  const [edit_user, set_edit_user] = useState(null)
  const [delete_target, set_delete_target] = useState(null)

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

  return (
    <>
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Manage Users</PanelTitle>
            <PanelDescription>
              Role/access is assigned in Microsoft Entra, not here - editing or deactivating a row below does not
              itself grant or revoke access. This list exists for visibility and local-account cleanup only.
            </PanelDescription>
          </div>
        </PanelHeader>
        <DataTable>
          <DataTableRow variant="admin" head>
            <span>Name</span>
            <span>Username</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Action</span>
          </DataTableRow>
          {users.map((user) => (
            <DataTableRow variant="admin" key={user.id}>
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
                  onClick={() => set_edit_user(user)}
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
            </DataTableRow>
          ))}
        </DataTable>

        {edit_user ? (
          <>
            <PanelSubheader>
              <PanelSubheaderTitle>Edit User — {edit_user.name}</PanelSubheaderTitle>
              <PanelSubheaderDescription>Leave the password blank to keep the current one.</PanelSubheaderDescription>
            </PanelSubheader>
            <UserEditForm
              key={edit_user.id}
              user={edit_user}
              set_error_message={set_error_message}
              on_cancel={() => set_edit_user(null)}
              on_saved={async () => {
                set_edit_user(null)
                await reload_all()
              }}
            />
          </>
        ) : null}
      </Panel>

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

function UserEditForm({ user, set_error_message, on_cancel, on_saved }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(user_edit_schema),
    mode: "onBlur",
    defaultValues: {
      name: user.name,
      username: user.username,
      email: user.email,
      status: user.is_active ? "active" : "inactive",
      password: "",
    },
  })

  const on_valid = async (data) => {
    try {
      const payload = {
        name: data.name,
        username: data.username,
        email: data.email,
        is_active: data.status === "active",
        password: data.password,
      }
      await api_fetch(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      show_toast("User updated.", "success")
      await on_saved()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not update the user.", "error")
    }
  }

  const on_invalid = () => {
    const first_error_key = Object.keys(errors)[0]
    const target = document.querySelector(
      first_error_key ? `[name="${first_error_key}"]` : "#user-edit-error-summary"
    )
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
    target?.focus?.()
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit(on_valid, on_invalid)} noValidate>
      {Object.keys(errors).length > 0 && (
        <div id="user-edit-error-summary" className="alert warning full" role="alert" tabIndex={-1}>
          <p>Fix the following before saving:</p>
          <ul className="list-disc pl-5">
            {Object.values(errors).map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}
      <label>
        Full name
        <input {...register("name")} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />
        {errors.name && (
          <span id="name-error" className="text-destructive text-sm" role="alert">
            {errors.name.message}
          </span>
        )}
      </label>
      <label>
        Username
        <input
          {...register("username")}
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "username-error" : undefined}
        />
        {errors.username && (
          <span id="username-error" className="text-destructive text-sm" role="alert">
            {errors.username.message}
          </span>
        )}
      </label>
      <label>
        Email
        <input
          type="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <span id="email-error" className="text-destructive text-sm" role="alert">
            {errors.email.message}
          </span>
        )}
      </label>
      <label>
        Status
        <select {...register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        Reset password
        <input type="password" {...register("password")} />
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          Save Changes
        </button>
        <button className="ghost-button" type="button" onClick={on_cancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const AUDIT_SCOPE = ["audit_logs"]

const audit_column_helper = createColumnHelper()

const audit_columns = [
  audit_column_helper.accessor(
    (entry) => format_audit_action_label(entry.action, entry.actor_type),
    {
      id: "action",
      header: "Action",
      cell: (info) => <span className="audit-action">{info.getValue()}</span>,
    }
  ),
  audit_column_helper.accessor(
    (entry) => {
      const metadata = safe_parse_metadata(entry.metadata_json || entry.metadata)
      return entry.entity_type || metadata.entity_type || "-"
    },
    { id: "entity", header: "Entity" }
  ),
  audit_column_helper.accessor(
    (entry) => format_audit_result(entry, safe_parse_metadata(entry.metadata_json || entry.metadata)),
    {
      id: "result",
      header: "Result",
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }
  ),
  audit_column_helper.accessor((entry) => (entry.created_at ? new Date(entry.created_at) : null), {
    id: "timestamp",
    header: "Timestamp",
    cell: (info) => {
      const value = info.getValue()
      return value ? value.toLocaleString() : "-"
    },
    sortingFn: "datetime",
  }),
]

function AuditTab() {
  useDataScope(AUDIT_SCOPE)
  const { audit_logs } = useAppData()

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Audit Log</PanelTitle>
          <PanelDescription>Every action recorded for traceability.</PanelDescription>
        </div>
      </PanelHeader>
      <SortableTable
        columns={audit_columns}
        data={audit_logs}
        empty_message="No audit entries recorded yet."
      />
    </Panel>
  )
}
