import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"

import { api_base_url, api_fetch, api_headers } from "./api"
import billingProcessDoc from "../../billing_process.md?raw"
import "./App.css"

const nav_items = [
  { id: "overview", label: "Overview" },
  { id: "cycles", label: "Billing Cycles" },
  { id: "scripts", label: "Script Generation" },
  { id: "runs", label: "Runs Tracking" },
  { id: "approvals", label: "Approvals" },
  { id: "notifications", label: "Notifications" },
  { id: "audit", label: "Audit Log" },
  { id: "documentation", label: "View Documentation" },
  { id: "admin", label: "Admin" },
]

const cycle_types = [
  "I1A",
  "M1B",
  "M1C",
  "M1F",
  "M1G",
  "M1R",
  "M1U",
  "M1V",
  "M1A",
  "A1A",
  "A1U",
]

const format_month_label = (value) => {
  if (!value) {
    return "-"
  }
  const [year, month] = value.split("-").map(Number)
  if (!year || !month) {
    return value
  }
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date)
}


const format_cycle_datetime = (value) => {
  if (!value) {
    return ""
  }
  const [year, month] = value.split("-").map(Number)
  if (!year || !month) {
    return ""
  }
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const thirtieth = new Date(year, month - 1, Math.min(30, last.getDate()))
  const format = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `${yyyy}_${mm}_${dd} 00:00:00`
  }
  return { first: format(first), last: format(last), thirtieth: format(thirtieth) }
}

const build_default_parameters = (script_type, environment, cycle_month) => {
  const bounds = format_cycle_datetime(cycle_month)
  if (script_type === "printing") {
    return {
      p1: "S",
      p2: `PBCC={cycle}|PITM=Y|PTEST=${environment === "test" ? "Y" : "N"}`,
      p3: bounds?.first || "YYYY_MM_DD 00:00:00",
      p4: bounds?.last || "YYYY_MM_DD 00:00:00",
      p5: "N",
      p6: "",
      p7: "0",
      p8: "99999999",
    }
  }

  return {
    p1: "{cycle}",
    p2: environment === "test" ? "T" : "N",
    p3: bounds?.thirtieth || "YYYY_MM_DD 00:00:00",
    p4: "28",
    p5: "2",
    p6: "",
    p7: "",
    p8: "",
  }
}

function App() {
  const [is_authenticated, set_is_authenticated] = useState(false)
  const [login_form, set_login_form] = useState({
    role: "billing",
    display_name: "",
  })
  const [active_view, set_active_view] = useState("overview")
  const [role, set_role] = useState("billing")
  const [cycles, set_cycles] = useState([])
  const [scripts, set_scripts] = useState([])
  const [runs, set_runs] = useState([])
  const [approvals, set_approvals] = useState([])
  const [notifications, set_notifications] = useState([])
  const [audit_logs, set_audit_logs] = useState([])
  const [users, set_users] = useState([])
  const [error_message, set_error_message] = useState("")

  const [cycle_form, set_cycle_form] = useState({
    usage_month: "",
    billing_month: "",
    notes: "",
  })
  const [script_form, set_script_form] = useState({
    billing_cycle_id: "",
    environment: "test",
    script_type: "preparation",
    log_types: [],
    p6: "",
  })
  const [use_default_params, set_use_default_params] = useState(true)
  const [parameter_overrides, set_parameter_overrides] = useState({
    p1: "",
    p2: "",
    p3: "",
    p4: "",
    p5: "",
    p6: "",
    p7: "",
    p8: "",
  })
  const [approval_form, set_approval_form] = useState({
    billing_cycle_id: "",
    stage: "test",
    status: "approved",
    comments: "",
  })
  const [approval_request_form, set_approval_request_form] = useState({
    billing_cycle_id: "",
    stage: "test",
    comments: "",
  })
  const [notification_form, set_notification_form] = useState({
    billing_cycle_id: "",
    channel: "smtp",
    recipient: "",
    subject: "",
    message: "",
  })
  const [run_environment, set_run_environment] = useState("test")
  const [run_cycle_id, set_run_cycle_id] = useState("")
  const [run_script_type, set_run_script_type] = useState("preparation")
  const [run_status_overrides, set_run_status_overrides] = useState({})
  const [approval_notifications, set_approval_notifications] = useState([])
  const [last_generated_count, set_last_generated_count] = useState(null)

  const status_cards = useMemo(() => {
    const pending_approvals = approvals.filter((item) => item.status === "pending").length
    return [
      {
        label: "Active Cycles",
        value: `${cycles.length} total`,
        tone: "neutral",
      },
      {
        label: "Pending Approvals",
        value: `${pending_approvals} awaiting finance`,
        tone: pending_approvals ? "warning" : "success",
      },
      {
        label: "Notifications",
        value: `${notifications.length} queued/sent`,
        tone: "info",
      },
    ]
  }, [approvals, cycles, notifications])

  useEffect(() => {
    if (use_default_params) {
      return
    }
    const cycle = cycles.find((item) => String(item.id) === script_form.billing_cycle_id)
    const cycle_month = cycle?.billing_month || cycle?.usage_month || ""
    const defaults = build_default_parameters(
      script_form.script_type,
      script_form.environment,
      cycle_month
    )
    set_parameter_overrides(defaults)
  }, [use_default_params, script_form.script_type, script_form.environment, cycles, script_form.billing_cycle_id])

  const visible_nav_items = useMemo(() => {
    const role_permissions = {
      billing: [
        "overview",
        "cycles",
        "scripts",
        "runs",
        "approvals",
        "notifications",
        "documentation",
      ],
      finance: ["overview", "approvals"],
      admin: ["overview", "cycles", "scripts", "runs", "approvals", "notifications", "audit", "admin"],
      viewer: ["overview", "runs", "approvals"],
    }
    const allowed = new Set(role_permissions[role] || [])
    return nav_items.filter((item) => allowed.has(item.id))
  }, [role])

  const reload_all = useCallback(async () => {
    try {
      set_error_message("")
      const [
        cycles_data,
        scripts_data,
        runs_data,
        approvals_data,
        notifications_data,
        audit_data,
      ] =
        await Promise.all([
          api_fetch("/cycles/", {}, role),
          api_fetch("/scripts/", {}, role),
          api_fetch("/runs/", {}, role),
          api_fetch("/approvals/", {}, role),
          api_fetch("/notifications/", {}, role),
          api_fetch("/audit/", {}, role),
        ])
      set_cycles(cycles_data)
      set_scripts(scripts_data)
      set_runs(runs_data)
      set_approvals(approvals_data)
      set_notifications(notifications_data)
      set_audit_logs(audit_data)

      if (role === "admin") {
        const users_data = await api_fetch("/users/", {}, role)
        set_users(users_data)
      } else {
        set_users([])
      }
    } catch (error) {
      set_error_message(error.message)
    }
  }, [role])

  useEffect(() => {
    reload_all()
    const interval = setInterval(reload_all, 30000)
    return () => clearInterval(interval)
  }, [reload_all])

  useEffect(() => {
    if (role !== "billing") {
      return
    }
    if (approvals.length === 0) {
      return
    }
    const storage_key = "billing_last_seen_approvals"
    const stored = localStorage.getItem(storage_key)
    const seen = stored ? JSON.parse(stored) : {}
    const newly_approved = approvals.filter(
      (approval) => approval.status === "approved" && seen[approval.id] !== approval.status
    )
    if (newly_approved.length > 0) {
      set_approval_notifications(newly_approved)
    }
    const next_seen = { ...seen }
    approvals.forEach((approval) => {
      next_seen[approval.id] = approval.status
    })
    localStorage.setItem(storage_key, JSON.stringify(next_seen))
  }, [approvals, role])

  useEffect(() => {
    const allowed_ids = new Set(visible_nav_items.map((item) => item.id))
    if (!allowed_ids.has(active_view)) {
      set_active_view("overview")
    }
  }, [active_view, visible_nav_items])

  const handle_cycle_submit = async (event) => {
    event.preventDefault()
    try {
      await api_fetch(
        "/cycles/",
        { method: "POST", body: JSON.stringify(cycle_form) },
        role
      )
      set_cycle_form({ usage_month: "", billing_month: "", notes: "" })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_script_toggle = (value) => {
    set_script_form((previous) => {
      const exists = previous.log_types.includes(value)
      const updated = exists
        ? previous.log_types.filter((item) => item !== value)
        : [...previous.log_types, value]
      return { ...previous, log_types: updated }
    })
  }

  const handle_select_all_cycles = () => {
    set_script_form((previous) => ({
      ...previous,
      log_types: previous.log_types.length === cycle_types.length ? [] : [...cycle_types],
    }))
  }

  const handle_script_submit = async (event) => {
    event.preventDefault()
    try {
      const overrides = use_default_params
        ? parameter_overrides.p6
          ? { p6: parameter_overrides.p6 }
          : undefined
        : Object.fromEntries(
            Object.entries(parameter_overrides).filter(([, value]) => value !== "")
          )
      const payload = {
        billing_cycle_id: script_form.billing_cycle_id,
        environment: script_form.environment,
        script_type: script_form.script_type,
        log_types: script_form.log_types,
        overrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
      }
      const created = await api_fetch(
        "/scripts/generate",
        { method: "POST", body: JSON.stringify(payload) },
        role
      )
      set_last_generated_count(Array.isArray(created) ? created.length : null)
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_export = async () => {
    if (!script_form.billing_cycle_id) {
      set_error_message("Select a billing cycle before exporting.")
      return
    }
    try {
      const export_record = await api_fetch(
        "/scripts/export",
        {
          method: "POST",
          body: JSON.stringify({
            billing_cycle_id: script_form.billing_cycle_id,
            environment: script_form.environment,
            script_type: script_form.script_type,
          }),
        },
        role
      )
      const response = await fetch(
        `${api_base_url}/scripts/exports/${export_record.id}/download`,
        { headers: api_headers(role) }
      )
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Export download failed")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = export_record.file_name || "billing_run_commands.log"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_export_all = async () => {
    if (!script_form.billing_cycle_id) {
      set_error_message("Select a billing cycle before exporting.")
      return
    }
    try {
      const export_record = await api_fetch(
        "/scripts/export-all",
        {
          method: "POST",
          body: JSON.stringify({
            billing_cycle_id: script_form.billing_cycle_id,
          }),
        },
        role
      )
      const response = await fetch(
        `${api_base_url}/scripts/exports/${export_record.id}/download`,
        { headers: api_headers(role) }
      )
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Export download failed")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = export_record.file_name || "billing_run_commands.log"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_approval_submit = async (event) => {
    event.preventDefault()
    try {
      await api_fetch(
        "/approvals/",
        { method: "POST", body: JSON.stringify(approval_form) },
        role
      )
      set_approval_form({
        billing_cycle_id: "",
        stage: "test",
        status: "approved",
        comments: "",
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_approval_request_submit = async (event) => {
    event.preventDefault()
    try {
      await api_fetch(
        "/approvals/request",
        { method: "POST", body: JSON.stringify(approval_request_form) },
        role
      )
      set_approval_request_form({ billing_cycle_id: "", stage: "test", comments: "" })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_run_stage_request = async () => {
    if (!run_cycle_id) {
      return
    }
    try {
      await api_fetch(
        "/approvals/request",
        {
          method: "POST",
          body: JSON.stringify({
            billing_cycle_id: run_cycle_id,
            stage: run_stage,
            comments: "",
          }),
        },
        role
      )
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_notification_submit = async (event) => {
    event.preventDefault()
    try {
      await api_fetch(
        "/notifications/",
        { method: "POST", body: JSON.stringify(notification_form) },
        role
      )
      set_notification_form({
        billing_cycle_id: "",
        channel: "smtp",
        recipient: "",
        subject: "",
        message: "",
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_run_status_change = async (script_id, status) => {
    set_run_status_overrides((previous) => ({
      ...previous,
      [script_id]: status,
    }))
    const run = runs_by_script_id.get(script_id)
    try {
      if (run) {
        await api_fetch(
          "/runs/",
          {
            method: "PATCH",
            body: JSON.stringify({
              script_run_id: run.id,
              status,
              notes: run.notes || "",
            }),
          },
          role
        )
      } else {
        await api_fetch(
          "/runs/",
          {
            method: "POST",
            body: JSON.stringify({
              script_definition_id: script_id,
              status,
              notes: "",
            }),
          },
          role
        )
      }
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const overview_runs = useMemo(() => {
    const status_priority = { failed: 0, planned: 1, executed: 2 }
    return [...runs]
      .sort((first, second) => {
        const first_priority = status_priority[first.status] ?? 3
        const second_priority = status_priority[second.status] ?? 3
        if (first_priority !== second_priority) {
          return first_priority - second_priority
        }
        const first_time = new Date(first.run_timestamp || first.created_at).getTime()
        const second_time = new Date(second.run_timestamp || second.created_at).getTime()
        return second_time - first_time
      })
      .slice(0, 6)
  }, [runs])
  const cycles_by_id = useMemo(
    () => new Map(cycles.map((cycle) => [String(cycle.id), cycle])),
    [cycles]
  )
  const format_stage_label = (stage) => {
    if (stage === "test") {
      return "Move to live"
    }
    if (stage === "post_live") {
      return "Move to notifications"
    }
    if (stage === "live") {
      return "Live complete"
    }
    return stage || "-"
  }
  const format_cycle_label = (cycle_id) => {
    if (!cycle_id) {
      return "-"
    }
    const cycle = cycles_by_id.get(String(cycle_id))
    if (!cycle) {
      return String(cycle_id).slice(0, 8)
    }
    return `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
  }
  const scripts_by_id = useMemo(
    () => new Map(scripts.map((script) => [String(script.id), script])),
    [scripts]
  )
  const runs_by_script_id = useMemo(
    () => new Map(runs.map((run) => [String(run.script_definition_id), run])),
    [runs]
  )
  const filtered_scripts = useMemo(() => {
    const selected_cycle = script_form.billing_cycle_id
    const selected_environment = script_form.environment
    const selected_type = script_form.script_type
    if (!selected_cycle) {
      return scripts
    }
    return scripts.filter(
      (script) =>
        String(script.billing_cycle_id) === selected_cycle &&
        script.environment === selected_environment &&
        script.script_type === selected_type
    )
  }, [scripts, script_form.billing_cycle_id, script_form.environment, script_form.script_type])
  const run_scripts = useMemo(() => {
    return scripts.filter((script) => {
      if (script.environment !== run_environment) {
        return false
      }
      if (script.script_type !== run_script_type) {
        return false
      }
      if (!run_cycle_id) {
        return true
      }
      return String(script.billing_cycle_id) === run_cycle_id
    })
  }, [scripts, run_environment, run_script_type, run_cycle_id])
  const pending_approvals = useMemo(
    () => approvals.filter((approval) => approval.status === "pending"),
    [approvals]
  )
  const approvals_by_cycle_stage = useMemo(() => {
    const map = new Map()
    approvals.forEach((approval) => {
      map.set(`${approval.billing_cycle_id}:${approval.stage}`, approval)
    })
    return map
  }, [approvals])
  const pending_approvals_by_cycle = useMemo(() => {
    const map = new Map()
    pending_approvals.forEach((approval) => {
      map.set(String(approval.billing_cycle_id), approval)
    })
    return map
  }, [pending_approvals])
  const run_cycle_options = useMemo(() => {
    const cycle_last_run = new Map()
    runs.forEach((run) => {
      const script = scripts_by_id.get(String(run.script_definition_id))
      if (!script) {
        return
      }
      const cycle_id = String(script.billing_cycle_id)
      const timestamp = run.run_timestamp || run.created_at
      if (!timestamp) {
        return
      }
      const current = cycle_last_run.get(cycle_id)
      const next_value = new Date(timestamp).getTime()
      if (!current || next_value > current) {
        cycle_last_run.set(cycle_id, next_value)
      }
    })

    const sorted = [...cycles].sort((first, second) => {
      const first_key =
        cycle_last_run.get(String(first.id)) || new Date(first.created_at).getTime()
      const second_key =
        cycle_last_run.get(String(second.id)) || new Date(second.created_at).getTime()
      return second_key - first_key
    })

    if (role !== "finance") {
      return sorted
    }
    return sorted.filter((cycle) => pending_approvals_by_cycle.has(String(cycle.id)))
  }, [cycles, pending_approvals_by_cycle, role, runs, scripts_by_id])
  const run_stage = run_environment === "test" ? "test" : "post_live"
  const run_stage_label = format_stage_label(run_stage)
  const run_stage_approval = useMemo(() => {
    if (!run_cycle_id) {
      return null
    }
    return approvals.find(
      (approval) =>
        String(approval.billing_cycle_id) === run_cycle_id && approval.stage === run_stage
    )
  }, [approvals, run_cycle_id, run_stage])
  const run_stage_scripts = useMemo(() => {
    if (!run_cycle_id) {
      return []
    }
    return scripts.filter(
      (script) =>
        String(script.billing_cycle_id) === run_cycle_id && script.environment === run_environment
    )
  }, [scripts, run_cycle_id, run_environment])
  const run_stage_ready = useMemo(() => {
    if (!run_cycle_id || run_stage_scripts.length === 0) {
      return false
    }
    const has_required = ["preparation", "printing"].every((script_type) =>
      run_stage_scripts.some((script) => script.script_type === script_type)
    )
    if (!has_required) {
      return false
    }
    return run_stage_scripts.every((script) => {
      const run = runs_by_script_id.get(String(script.id))
      return run?.status === "executed"
    })
  }, [run_cycle_id, run_stage_scripts, runs_by_script_id])
  const can_request_run_stage = useMemo(() => {
    if (!run_stage_ready) {
      return false
    }
    if (!run_stage_approval) {
      return true
    }
    return !["pending", "approved"].includes(run_stage_approval.status)
  }, [run_stage_ready, run_stage_approval])
  const run_stage_request_label = useMemo(() => {
    if (!run_cycle_id) {
      return "Select a cycle to request approval"
    }
    if (!run_stage_ready) {
      return "Execute all preparation and printing scripts first"
    }
    if (run_stage_approval?.status === "pending") {
      return "Approval already requested"
    }
    if (run_stage_approval?.status === "approved") {
      return "Approval already granted"
    }
    return `Request ${run_stage_label} approval`
  }, [run_cycle_id, run_stage_ready, run_stage_approval, run_stage_label])
  const test_approval = useMemo(() => {
    if (!script_form.billing_cycle_id) {
      return null
    }
    return approvals_by_cycle_stage.get(`${script_form.billing_cycle_id}:test`)
  }, [approvals_by_cycle_stage, script_form.billing_cycle_id])
  const live_generation_blocked =
    script_form.environment === "live" && test_approval?.status !== "approved"
  const post_live_approval = useMemo(() => {
    if (!notification_form.billing_cycle_id) {
      return null
    }
    return approvals_by_cycle_stage.get(`${notification_form.billing_cycle_id}:post_live`)
  }, [approvals_by_cycle_stage, notification_form.billing_cycle_id])
  const notification_blocked = post_live_approval?.status !== "approved"

  if (!is_authenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand">
            <div className="brand-mark">BL</div>
            <div>
              <p className="brand-title">Billing Ledger</p>
              <p className="brand-subtitle">Automation Hub</p>
            </div>
          </div>
          <div className="login-body">
            <h2>Sign in</h2>
            <p>Choose your role to access the workspace.</p>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                set_role(login_form.role)
                set_is_authenticated(true)
                set_active_view("overview")
              }}
            >
              <label>
                Display name
                <input
                  value={login_form.display_name}
                  onChange={(event) =>
                    set_login_form((previous) => ({
                      ...previous,
                      display_name: event.target.value,
                    }))
                  }
                  placeholder="Billing User"
                />
              </label>
              <label>
                Role
                <select
                  value={login_form.role}
                  onChange={(event) =>
                    set_login_form((previous) => ({
                      ...previous,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="billing">Billing</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button className="primary-button" type="submit">
                Enter dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">BL</div>
          <div>
            <p className="brand-title">Billing Ledger</p>
            <p className="brand-subtitle">Automation Hub</p>
          </div>
        </div>
        <nav className="nav">
          {visible_nav_items.map((item) => (
            <button
              className={`nav-item ${active_view === item.id ? "active" : ""}`}
              key={item.id}
              type="button"
              onClick={() => set_active_view(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>
            <p className="footer-label">Current role</p>
            <p className="footer-value">{role}</p>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              set_is_authenticated(false)
              set_role("billing")
              set_login_form({ role: "billing", display_name: "" })
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="topbar-title">Billing Operations</p>
            <p className="topbar-subtitle">
              Connected to <span className="mono">{api_base_url}</span>
            </p>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button" type="button" onClick={reload_all}>
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={() => set_active_view("cycles")}>
              New cycle
            </button>
          </div>
        </header>

        {error_message ? <div className="alert error">{error_message}</div> : null}
        {role === "billing" && approval_notifications.length > 0 ? (
          <div className="alert info">
            {approval_notifications.map((approval) => (
              <div key={approval.id}>
                Approval granted for {format_stage_label(approval.stage)} on cycle {format_cycle_label(approval.billing_cycle_id)}.
              </div>
            ))}
          </div>
        ) : null}

        {active_view === "overview" && (
          <>
            <section className="grid-cards">
              {status_cards.map((card) => (
                <div className={`status-card ${card.tone}`} key={card.label}>
                  <p className="card-label">{card.label}</p>
                  <p className="card-value">{card.value}</p>
                </div>
              ))}
            </section>

            <section className="content-grid">
              {role !== "finance" && (
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Recent Billing Runs</h2>
                      <p>Latest execution status updates.</p>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => set_active_view("runs")}
                    >
                      Review runs
                    </button>
                  </div>
                  <div className="table">
                    <div className="table-row table-head">
                      <span>Cycle</span>
                      <span>Cycle Type</span>
                      <span>Script</span>
                      <span>Status</span>
                      <span>Updated</span>
                    </div>
                    {overview_runs.map((run) => {
                      const script = scripts_by_id.get(String(run.script_definition_id))
                      const cycle = script ? cycles_by_id.get(String(script.billing_cycle_id)) : null
                      const cycle_label = cycle
                        ? `${format_month_label(cycle.usage_month)} - ${format_month_label(
                            cycle.billing_month
                          )}`
                        : script?.billing_cycle_id
                        ? String(script.billing_cycle_id).slice(0, 8)
                        : "-"
                      return (
                        <div className="table-row" key={run.id}>
                          <span>{cycle_label}</span>
                          <span>{script?.log_type || "-"}</span>
                          <span>{script?.script_type || "-"}</span>
                          <span
                            className={`pill ${
                              run.status === "executed"
                                ? "success"
                                : run.status === "failed"
                                ? "danger"
                                : "warning"
                            }`}
                          >
                            {run.status}
                          </span>
                          <span>{
                            run.run_timestamp
                              ? new Date(run.run_timestamp).toLocaleString()
                              : new Date(run.created_at).toLocaleString()
                          }</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Approvals Queue</h2>
                    <p>Finance checkpoints before advancing the workflow.</p>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => set_active_view("approvals")}
                  >
                    Review approvals
                  </button>
                </div>
                <div className="table">
                  <div className="table-row table-head">
                    <span>Cycle</span>
                    <span>Stage</span>
                    <span>Status</span>
                    <span>{role === "finance" ? "Action" : "Updated"}</span>
                  </div>
                  {(role === "finance" ? pending_approvals : approvals.slice(0, 6)).map((approval) => (
                    <div className="table-row" key={approval.id}>
                      <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                      <span>{format_stage_label(approval.stage)}</span>
                      <span className={`pill ${approval.status === "pending" ? "warning" : "success"}`}>
                        {approval.status}
                      </span>
                      {role === "finance" ? (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            set_approval_form((previous) => ({
                              ...previous,
                              billing_cycle_id: String(approval.billing_cycle_id),
                              stage: approval.stage,
                              status: "approved",
                            }))
                            set_active_view("approvals")
                          }}
                        >
                          Review
                        </button>
                      ) : (
                        <span>{new Date(approval.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {active_view === "cycles" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Billing Cycles</h2>
                <p>Create and review usage/billing month pairs.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handle_cycle_submit}>
              <label>
                Usage month
                <input
                  type="month"
                  value={cycle_form.usage_month}
                  onChange={(event) =>
                    set_cycle_form((previous) => ({
                      ...previous,
                      usage_month: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Billing month
                <input
                  type="month"
                  value={cycle_form.billing_month}
                  onChange={(event) =>
                    set_cycle_form((previous) => ({
                      ...previous,
                      billing_month: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="full">
                Notes
                <textarea
                  value={cycle_form.notes}
                  onChange={(event) =>
                    set_cycle_form((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Create cycle
              </button>
            </form>
            <div className="table">
              <div className="table-row table-head">
                <span>Usage</span>
                <span>Billing</span>
                <span>Status</span>
                <span>Created</span>
              </div>
              {cycles.map((cycle) => (
                <div className="table-row" key={cycle.id}>
                  <span>{format_month_label(cycle.usage_month)}</span>
                  <span>{format_month_label(cycle.billing_month)}</span>
                  <span className="pill neutral">{cycle.status}</span>
                  <span>{new Date(cycle.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {active_view === "scripts" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Script Generation</h2>
                <p>Select a cycle, environment, and cycle types to generate commands.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handle_script_submit}>
              <label>
                Billing cycle
                <select
                  value={script_form.billing_cycle_id}
                  onChange={(event) =>
                    set_script_form((previous) => ({
                      ...previous,
                      billing_cycle_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a cycle</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {format_month_label(cycle.usage_month)} - {format_month_label(cycle.billing_month)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Environment
                <select
                  value={script_form.environment}
                  onChange={(event) =>
                    set_script_form((previous) => ({
                      ...previous,
                      environment: event.target.value,
                    }))
                  }
                >
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </select>
              </label>
              <label>
                Script type
                <select
                  value={script_form.script_type}
                  onChange={(event) =>
                    set_script_form((previous) => ({
                      ...previous,
                      script_type: event.target.value,
                    }))
                  }
                >
                  <option value="preparation">Preparation</option>
                  <option value="printing">Printing</option>
                </select>
              </label>
              <label className="full">
                <div className="toggle-row">
                  <input
                    id="use-default-params"
                    type="checkbox"
                    checked={use_default_params}
                    onChange={(event) => set_use_default_params(event.target.checked)}
                  />
                  <span>Use default parameters</span>
                </div>
              </label>
              {use_default_params && script_form.script_type === "printing" && (
                <label>
                  P6 Billing Run UID
                  <input
                    value={parameter_overrides.p6}
                    onChange={(event) =>
                      set_parameter_overrides((previous) => ({
                        ...previous,
                        p6: event.target.value,
                      }))
                    }
                    placeholder="billing_run_uid"
                    required
                  />
                </label>
              )}
              {!use_default_params && (
                <div className="parameter-grid">
                  {Object.keys(parameter_overrides).map((key) => (
                    <label key={key}>
                      {key.toUpperCase()}
                      <input
                        value={parameter_overrides[key]}
                        onChange={(event) =>
                          set_parameter_overrides((previous) => ({
                            ...previous,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder={key.toUpperCase()}
                        required={script_form.script_type === "printing" && key === "p6"}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="full">
                <p className="helper">Cycle types</p>
                <div className="select-all-row">
                  <button className="secondary-button" type="button" onClick={handle_select_all_cycles}>
                    {script_form.log_types.length === cycle_types.length ? "Clear all" : "Select all cycles"}
                  </button>
                </div>
                <div className="checkbox-grid">
                  {cycle_types.map((cycle) => (
                    <label key={cycle} className="checkbox-pill">
                      <input
                        type="checkbox"
                        checked={script_form.log_types.includes(cycle)}
                        onChange={() => handle_script_toggle(cycle)}
                      />
                      <span>{cycle}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={live_generation_blocked}>
                  Generate scripts
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handle_export}
                  disabled={live_generation_blocked}
                >
                  Export grouped file
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handle_export_all}
                  disabled={live_generation_blocked}
                >
                  Export all scripts
                </button>
              </div>
            </form>
            {live_generation_blocked && script_form.billing_cycle_id ? (
              <div className="alert warning">
                Test approval is required before generating live scripts.
              </div>
            ) : null}
            <div className="table">
              <div className="table-row table-head">
                <span>Cycle & Command</span>
                <span>Environment</span>
                <span>Cycle Type</span>
                <span>Created</span>
              </div>
              {filtered_scripts.map((script) => {
                const cycle = cycles_by_id.get(String(script.billing_cycle_id))
                const cycle_label = cycle
                  ? `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
                  : script.billing_cycle_id.slice(0, 8)
                return (
                  <div className="table-row" key={script.id}>
                    <div className="stacked-cell">
                      <span>{cycle_label}</span>
                      <span className="mono">{script.command_text}</span>
                    </div>
                    <span>{script.environment}</span>
                    <span>{script.log_type}</span>
                    <span>{new Date(script.created_at).toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
            {last_generated_count !== null ? (
              <div className="alert info">
                Generated {last_generated_count} scripts for the selected run.
              </div>
            ) : null}
          </section>
        )}

        {active_view === "runs" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Runs Tracking</h2>
                <p>Track completion by cycle, environment, and script type.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Billing cycle
                <select value={run_cycle_id} onChange={(event) => set_run_cycle_id(event.target.value)}>
                  <option value="">All cycles</option>
                  {run_cycle_options.map((cycle) => {
                    const pending = pending_approvals_by_cycle.get(String(cycle.id))
                    const stage_label = pending ? ` (${pending.stage})` : ""
                    return (
                      <option key={cycle.id} value={cycle.id}>
                        {format_month_label(cycle.usage_month)} - {format_month_label(cycle.billing_month)}{stage_label}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label>
                Script type
                <select
                  value={run_script_type}
                  onChange={(event) => set_run_script_type(event.target.value)}
                >
                  <option value="preparation">Preparation</option>
                  <option value="printing">Printing</option>
                </select>
              </label>
            </div>
            <div className="tab-row">
              <button
                className={`tab-button ${run_environment === "test" ? "active" : ""}`}
                type="button"
                onClick={() => set_run_environment("test")}
              >
                Test
              </button>
              <button
                className={`tab-button ${run_environment === "live" ? "active" : ""}`}
                type="button"
                onClick={() => set_run_environment("live")}
              >
                Live
              </button>
            </div>
            {role !== "finance" && role !== "viewer" && run_cycle_id ? (
              <div className="run-approval-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handle_run_stage_request}
                  disabled={!can_request_run_stage}
                >
                  {run_stage_label} approval
                </button>
                <span className="run-approval-note">{run_stage_request_label}</span>
              </div>
            ) : null}
            <div className="table">
              <div className="table-row table-head runs">
                <span>Cycle</span>
                <span>Cycle Type</span>
                <span>Status</span>
                <span>Executed</span>
              </div>
              {!run_cycle_id ? (
                <div className="empty-state">Select a billing cycle to view run status.</div>
              ) : run_scripts.length === 0 ? (
                <div className="empty-state">No scripts found for this selection yet.</div>
              ) : (
                run_scripts.map((script) => {
                  const cycle = cycles_by_id.get(String(script.billing_cycle_id))
                  const cycle_label = cycle
                    ? `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
                    : String(script.billing_cycle_id).slice(0, 8)
                  const run = runs_by_script_id.get(String(script.id))
                  const current_status = run?.status || "planned"
                  const selected_status =
                    run_status_overrides[String(script.id)] || current_status
                  const status_class = `status-select ${selected_status}`
                  const is_read_only = role === "finance" || role === "viewer"
                  return (
                    <div className="table-row runs" key={script.id}>
                      <span>{cycle_label}</span>
                      <span>{script.log_type}</span>
                      <select
                        className={`select-inline ${status_class}`}
                        value={selected_status}
                        onChange={(event) =>
                          handle_run_status_change(String(script.id), event.target.value)
                        }
                        disabled={is_read_only}
                      >
                        <option value="planned">Planned</option>
                        <option value="executed">Executed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <span>{run?.run_timestamp ? new Date(run.run_timestamp).toLocaleString() : "-"}</span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {active_view === "approvals" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Approvals</h2>
                <p>Finance approvals unlock live generation and notifications.</p>
              </div>
            </div>
            {role !== "finance" && (
              <form className="form-grid" onSubmit={handle_approval_request_submit}>
                <label>
                  Billing cycle
                  <select
                    value={approval_request_form.billing_cycle_id}
                    onChange={(event) =>
                      set_approval_request_form((previous) => ({
                        ...previous,
                        billing_cycle_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select a cycle</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {format_month_label(cycle.usage_month)} - {format_month_label(cycle.billing_month)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Stage
                  <select
                    value={approval_request_form.stage}
                    onChange={(event) =>
                      set_approval_request_form((previous) => ({
                        ...previous,
                        stage: event.target.value,
                      }))
                    }
                  >
                    <option value="test">Move to live</option>
                    <option value="post_live">Move to notifications</option>
                  </select>
                </label>
                <label className="full">
                  Comments
                  <textarea
                    value={approval_request_form.comments}
                    onChange={(event) =>
                      set_approval_request_form((previous) => ({
                        ...previous,
                        comments: event.target.value,
                      }))
                    }
                  />
                </label>
                <button className="primary-button" type="submit">
                  Request approval
                </button>
              </form>
            )}
            {role === "finance" && (
              <>
                <div className="panel-subheader">
                  <h3>Requested approvals</h3>
                  <p>Pick a request to approve or reject.</p>
                </div>
                <div className="table">
                  <div className="table-row table-head">
                    <span>Cycle</span>
                    <span>Stage</span>
                    <span>Requested</span>
                    <span>Action</span>
                  </div>
                  {pending_approvals.length === 0 ? (
                    <div className="empty-state">No pending approvals.</div>
                  ) : (
                    pending_approvals.map((approval) => (
                      <div className="table-row" key={approval.id}>
                        <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                        <span>{format_stage_label(approval.stage)}</span>
                        <span>{new Date(approval.updated_at).toLocaleString()}</span>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            set_approval_form((previous) => ({
                              ...previous,
                              billing_cycle_id: String(approval.billing_cycle_id),
                              stage: approval.stage,
                              status: "approved",
                            }))
                          }
                        >
                          Review
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <form className="form-grid" onSubmit={handle_approval_submit}>
                  <label>
                    Billing cycle
                    <input
                      value={
                        approval_form.billing_cycle_id
                          ? format_cycle_label(approval_form.billing_cycle_id)
                          : ""
                      }
                      disabled
                      placeholder="Select a requested approval"
                    />
                  </label>
                  <label>
                    Stage
                    <select
                      value={approval_form.stage}
                      onChange={(event) =>
                        set_approval_form((previous) => ({
                          ...previous,
                          stage: event.target.value,
                        }))
                      }
                    >
                      <option value="test">Move to live</option>
                      <option value="live">Live complete</option>
                      <option value="post_live">Move to notifications</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={approval_form.status}
                      onChange={(event) =>
                        set_approval_form((previous) => ({
                          ...previous,
                          status: event.target.value,
                        }))
                      }
                    >
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="full">
                    Comments
                    <textarea
                      value={approval_form.comments}
                      onChange={(event) =>
                        set_approval_form((previous) => ({
                          ...previous,
                          comments: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={!approval_form.billing_cycle_id}>
                    Submit approval
                  </button>
                </form>

                <div className="panel-subheader">
                  <h3>Past approvals</h3>
                  <p>Completed approvals for this billing run history.</p>
                </div>
                <div className="table">
                  <div className="table-row table-head">
                    <span>Cycle</span>
                    <span>Stage</span>
                    <span>Status</span>
                    <span>Updated</span>
                  </div>
                  {approvals.filter((approval) => approval.status !== "pending").length === 0 ? (
                    <div className="empty-state">No completed approvals yet.</div>
                  ) : (
                    approvals
                      .filter((approval) => approval.status !== "pending")
                      .map((approval) => (
                        <div className="table-row" key={approval.id}>
                          <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                          <span>{format_stage_label(approval.stage)}</span>
                          <span
                            className={`pill ${
                              approval.status === "approved"
                                ? "success"
                                : approval.status === "rejected"
                                ? "warning"
                                : "neutral"
                            }`}
                          >
                            {approval.status}
                          </span>
                          <span>{new Date(approval.updated_at).toLocaleString()}</span>
                        </div>
                      ))
                  )}
                </div>
              </>
            )}
            {role !== "finance" && (
              <div className="table">
                <div className="table-row table-head">
                  <span>Cycle</span>
                  <span>Stage</span>
                  <span>Status</span>
                  <span>Updated</span>
                </div>
                {approvals.map((approval) => (
                  <div className="table-row" key={approval.id}>
                    <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                    <span>{format_stage_label(approval.stage)}</span>
                    <span
                      className={`pill ${
                        approval.status === "approved"
                          ? "success"
                          : approval.status === "rejected"
                          ? "warning"
                          : "neutral"
                      }`}
                    >
                      {approval.status}
                    </span>
                    <span>{new Date(approval.updated_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {active_view === "notifications" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Notifications</h2>
                <p>Send notifications after post-live approval.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handle_notification_submit}>
              <label>
                Billing cycle
                <select
                  value={notification_form.billing_cycle_id}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      billing_cycle_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a cycle</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {format_month_label(cycle.usage_month)} - {format_month_label(cycle.billing_month)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Channel
                <select
                  value={notification_form.channel}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      channel: event.target.value,
                    }))
                  }
                >
                  <option value="smtp">SMTP</option>
                  <option value="n8n">n8n</option>
                </select>
              </label>
              <label>
                Recipient
                <input
                  value={notification_form.recipient}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      recipient: event.target.value,
                    }))
                  }
                  placeholder="finance@example.com"
                  required
                />
              </label>
              <label>
                Subject
                <input
                  value={notification_form.subject}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      subject: event.target.value,
                    }))
                  }
                  placeholder="Billing cycle approved"
                  required
                />
              </label>
              <label className="full">
                Message
                <textarea
                  value={notification_form.message}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      message: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Send notification
              </button>
            </form>
            {notification_form.billing_cycle_id && notification_blocked ? (
              <div className="alert warning">
                Post-live approval is required before sending notifications.
              </div>
            ) : null}
            <div className="table">
              <div className="table-row table-head">
                <span>Recipient</span>
                <span>Channel</span>
                <span>Status</span>
                <span>Sent</span>
              </div>
              {notifications.map((notification) => (
                <div className="table-row" key={notification.id}>
                  <span>{notification.recipient}</span>
                  <span>{notification.channel}</span>
                  <span className={`pill ${notification.status === "sent" ? "success" : "warning"}`}>
                    {notification.status}
                  </span>
                  <span>
                    {notification.sent_at ? new Date(notification.sent_at).toLocaleString() : "-"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {active_view === "audit" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Audit Log</h2>
                <p>Every action recorded for traceability.</p>
              </div>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>Action</span>
                <span>Entity</span>
                <span>Actor</span>
                <span>Timestamp</span>
              </div>
              {audit_logs.map((entry) => (
                <div className="table-row" key={entry.id}>
                  <span>{entry.action}</span>
                  <span>{entry.entity_type}</span>
                  <span>{entry.actor_type}</span>
                  <span>{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {active_view === "documentation" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Billing Process Documentation</h2>
                <p>Reference guide for billing operations.</p>
              </div>
            </div>
            <div className="doc-content markdown">
              <ReactMarkdown>{billingProcessDoc}</ReactMarkdown>
            </div>
          </section>
        )}

        {active_view === "admin" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Admin Overview</h2>
                <p>Visibility into registered users.</p>
              </div>
            </div>
            <div className="table">
              <div className="table-row table-head">
                <span>Username</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
              </div>
              {users.map((user) => (
                <div className="table-row" key={user.id}>
                  <span>{user.username}</span>
                  <span>{user.email}</span>
                  <span>{user.role}</span>
                  <span className={`pill ${user.is_active ? "success" : "warning"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
