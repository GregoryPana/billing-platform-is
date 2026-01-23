import { useEffect, useMemo, useState } from "react"

import { api_base_url, api_fetch } from "./api"
import "./App.css"

const nav_items = [
  { id: "overview", label: "Overview" },
  { id: "cycles", label: "Billing Cycles" },
  { id: "scripts", label: "Script Generation" },
  { id: "runs", label: "Runs Tracking" },
  { id: "approvals", label: "Approvals" },
  { id: "notifications", label: "Notifications" },
  { id: "audit", label: "Audit Log" },
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

function App() {
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
        label: "Scripts Generated",
        value: `${scripts.length} commands`,
        tone: "success",
      },
      {
        label: "Notifications",
        value: `${notifications.length} queued/sent`,
        tone: "info",
      },
    ]
  }, [approvals, cycles, notifications, scripts])

  const reload_all = async () => {
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
  }

  useEffect(() => {
    reload_all()
  }, [role])

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
      const payload = {
        billing_cycle_id: script_form.billing_cycle_id,
        environment: script_form.environment,
        script_type: script_form.script_type,
        log_types: script_form.log_types,
        overrides: script_form.p6 ? { p6: script_form.p6 } : undefined,
      }
      await api_fetch(
        "/scripts/generate",
        { method: "POST", body: JSON.stringify(payload) },
        role
      )
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
      await api_fetch(
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

  const overview_runs = scripts.slice(0, 6)
  const cycles_by_id = useMemo(
    () => new Map(cycles.map((cycle) => [String(cycle.id), cycle])),
    [cycles]
  )
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
  const pending_approvals_by_cycle = useMemo(() => {
    const map = new Map()
    pending_approvals.forEach((approval) => {
      map.set(String(approval.billing_cycle_id), approval)
    })
    return map
  }, [pending_approvals])
  const run_cycle_options = useMemo(() => {
    if (role !== "finance") {
      return cycles
    }
    return cycles.filter((cycle) => pending_approvals_by_cycle.has(String(cycle.id)))
  }, [cycles, pending_approvals_by_cycle, role])

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
          {nav_items.map((item) => (
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
          <select
            className="select-inline"
            value={role}
            onChange={(event) => set_role(event.target.value)}
          >
            <option value="billing">Billing</option>
            <option value="finance">Finance</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
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
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Recent Scripts</h2>
                    <p>Latest definitions for the current workspace.</p>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => set_active_view("scripts")}>
                    Generate scripts
                  </button>
                </div>
                <div className="table">
                  <div className="table-row table-head">
                    <span>Script</span>
                    <span>Environment</span>
                    <span>Cycle</span>
                    <span>Created</span>
                  </div>
                  {overview_runs.map((run) => (
                    <div className="table-row" key={run.id}>
                      <span>{run.script_type}</span>
                      <span>{run.environment}</span>
                      <span>{run.log_type}</span>
                      <span>{new Date(run.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

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
                    <span>Updated</span>
                  </div>
                  {approvals.slice(0, 6).map((approval) => (
                    <div className="table-row" key={approval.id}>
                      <span>{approval.billing_cycle_id.slice(0, 8)}</span>
                      <span>{approval.stage}</span>
                      <span className={`pill ${approval.status === "pending" ? "warning" : "success"}`}>
                        {approval.status}
                      </span>
                      <span>{new Date(approval.updated_at).toLocaleString()}</span>
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
                  <span>{cycle.usage_month}</span>
                  <span>{cycle.billing_month}</span>
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
                      {cycle.usage_month} → {cycle.billing_month}
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
              {script_form.script_type === "printing" && (
                <label>
                  P6 Billing Run UID
                  <input
                    value={script_form.p6}
                    onChange={(event) =>
                      set_script_form((previous) => ({ ...previous, p6: event.target.value }))
                    }
                    placeholder="billing_run_uid"
                    required
                  />
                </label>
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
                <button className="primary-button" type="submit">
                  Generate scripts
                </button>
                <button className="secondary-button" type="button" onClick={handle_export}>
                  Export grouped file
                </button>
              </div>
            </form>
            <div className="table-meta">
              <span>
                Showing <strong>{filtered_scripts.length}</strong> scripts
                {script_form.billing_cycle_id ? " for the selected cycle" : ""}.
              </span>
            </div>
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
                  ? `${cycle.usage_month} → ${cycle.billing_month}`
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
                        {cycle.usage_month} → {cycle.billing_month}{stage_label}
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
                    ? `${cycle.usage_month} → ${cycle.billing_month}`
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
                        {cycle.usage_month} → {cycle.billing_month}
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
                  >
                    <option value="test">Test</option>
                    <option value="post_live">Post-live</option>
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
                  />
                </label>
                <button className="primary-button" type="submit">
                  Request approval
                </button>
              </form>
            )}
            {role === "finance" && (
              <form className="form-grid" onSubmit={handle_approval_submit}>
                <label>
                  Billing cycle
                  <select
                    value={approval_form.billing_cycle_id}
                    onChange={(event) => {
                      const selected_id = event.target.value
                      const selected = pending_approvals.find(
                        (approval) => String(approval.billing_cycle_id) === selected_id
                      )
                      set_approval_form((previous) => ({
                        ...previous,
                        billing_cycle_id: selected_id,
                        stage: selected?.stage || previous.stage,
                      }))
                    }}
                  >
                    <option value="">Select a cycle</option>
                    {pending_approvals.map((approval) => {
                      const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
                      const label = cycle
                        ? `${cycle.usage_month} → ${cycle.billing_month}`
                        : approval.billing_cycle_id.slice(0, 8)
                      return (
                        <option key={approval.id} value={approval.billing_cycle_id}>
                          {label} ({approval.stage})
                        </option>
                      )
                    })}
                  </select>
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
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                    <option value="post_live">Post-live</option>
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
                <button className="primary-button" type="submit">
                  Submit approval
                </button>
              </form>
            )}
            <div className="table">
              <div className="table-row table-head">
                <span>Cycle</span>
                <span>Stage</span>
                <span>Status</span>
                <span>Updated</span>
              </div>
              {(role === "finance" ? pending_approvals : approvals).map((approval) => (
                <div className="table-row" key={approval.id}>
                  <span>{approval.billing_cycle_id.slice(0, 8)}</span>
                  <span>{approval.stage}</span>
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
                      {cycle.usage_month} → {cycle.billing_month}
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
