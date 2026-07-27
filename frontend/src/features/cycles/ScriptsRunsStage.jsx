import { useCallback, useEffect, useMemo, useState } from "react"

import { api_base_url, api_fetch, get_auth_token } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { build_default_parameters, cycle_types } from "../../lib/format"
import { ExecutionIssueDialog } from "../issues/ExecutionIssueDialog"
import { IssueActivityDialog } from "../issues/IssueActivityDialog"
import { list_finance_issues, list_issue_classifications } from "../issues/issue-api"

/* One stage = script generation + run tracking for a single cycle+environment.
   The cycle and environment are fixed by the workspace; no re-selection. */
export function ScriptsRunsStage({ cycle, environment, blocked, blocked_reason }) {
  const { role, scripts, runs_by_script_id, reload_all, set_error_message } = useAppData()
  const can_operate = role === "billing_user" || role === "system_admin"

  const [script_type, set_script_type] = useState("preparation")
  const [use_default_params, set_use_default_params] = useState(true)
  const [parameter_overrides, set_parameter_overrides] = useState({
    p1: "", p2: "", p3: "", p4: "", p5: "", p6: "", p7: "", p8: "",
  })
  const [log_types, set_log_types] = useState([])
  const [generating, set_generating] = useState(false)
  const [last_generated_count, set_last_generated_count] = useState(null)

  const [execution_issues, set_execution_issues] = useState([])
  const [execution_classifications_by_id, set_execution_classifications_by_id] = useState(new Map())
  const [issue_dialog_run, set_issue_dialog_run] = useState(null)
  const [active_execution_issue, set_active_execution_issue] = useState(null)

  const cycle_month = cycle?.usage_month || ""

  const reload_execution_issues = useCallback(async () => {
    try {
      const data = await list_finance_issues(cycle.id, "execution_issue")
      set_execution_issues(data)
    } catch {
      // Non-critical: the run table already conveys readiness via run status.
    }
  }, [cycle.id])

  useEffect(() => {
    reload_execution_issues()
  }, [reload_execution_issues])

  useEffect(() => {
    list_issue_classifications("execution_issue")
      .then((data) => set_execution_classifications_by_id(new Map(data.map((item) => [item.id, item.name]))))
      .catch(() => {})
  }, [])

  const execution_issues_by_run_id = useMemo(() => {
    const map = new Map()
    for (const issue of execution_issues) {
      if (!issue.related_script_run_id) continue
      const list = map.get(issue.related_script_run_id) || []
      list.push(issue)
      map.set(issue.related_script_run_id, list)
    }
    return map
  }, [execution_issues])

  useEffect(() => {
    if (use_default_params) {
      set_parameter_overrides(build_default_parameters(script_type, environment, cycle_month))
    }
  }, [use_default_params, script_type, environment, cycle_month])

  const stage_scripts = useMemo(
    () =>
      scripts.filter(
        (script) => String(script.billing_cycle_id) === String(cycle.id) && script.environment === environment
      ),
    [scripts, cycle, environment]
  )

  const handle_script_toggle = (value) => {
    set_log_types((previous) =>
      previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]
    )
  }

  const handle_select_all = () => {
    set_log_types((previous) => (previous.length === cycle_types.length ? [] : [...cycle_types]))
  }

  const handle_generate = async (event) => {
    event.preventDefault()
    try {
      set_generating(true)
      const overrides = use_default_params
        ? parameter_overrides.p6
          ? { p6: parameter_overrides.p6 }
          : undefined
        : Object.fromEntries(Object.entries(parameter_overrides).filter(([, value]) => value !== ""))
      const payload = {
        billing_cycle_id: String(cycle.id),
        environment,
        script_type,
        log_types,
        overrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
      }
      const created = await api_fetch("/scripts/generate", { method: "POST", body: JSON.stringify(payload) })
      set_last_generated_count(Array.isArray(created) ? created.length : null)
      show_toast("Scripts generated successfully.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Failed to generate scripts.", "error")
    } finally {
      set_generating(false)
    }
  }

  const download_export = async (endpoint, body) => {
    try {
      const export_record = await api_fetch(endpoint, { method: "POST", body: JSON.stringify(body) })
      const token = get_auth_token()
      const response = await fetch(`${api_base_url}/scripts/exports/${export_record.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
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
      show_toast("Export downloaded.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Export failed.", "error")
    }
  }

  const handle_run_status_change = async (script_id, status) => {
    const run = runs_by_script_id.get(script_id)
    try {
      if (run) {
        await api_fetch("/runs/", {
          method: "PATCH",
          body: JSON.stringify({ script_run_id: run.id, status, notes: run.notes || "" }),
        })
      } else {
        await api_fetch("/runs/", {
          method: "POST",
          body: JSON.stringify({ script_definition_id: script_id, status, notes: "" }),
        })
      }
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Could not update the run status.", "error")
    }
  }

  if (blocked) {
    return <div className="alert warning">{blocked_reason}</div>
  }

  return (
    <>
      {can_operate && (
        <form className="form-grid" onSubmit={handle_generate}>
          <label>
            Script type
            <select value={script_type} onChange={(event) => set_script_type(event.target.value)}>
              <option value="preparation">Preparation</option>
              <option value="printing">Printing</option>
            </select>
          </label>
          <label className="full">
            <div className="toggle-row">
              <input
                type="checkbox"
                checked={use_default_params}
                onChange={(event) => set_use_default_params(event.target.checked)}
              />
              <span>Use default parameters</span>
            </div>
          </label>
          <div className="parameter-grid">
            {Object.keys(parameter_overrides).map((key) => (
              <label key={key} className={use_default_params ? "is-read-only" : ""}>
                {key.toUpperCase()}
                <input
                  value={parameter_overrides[key]}
                  onChange={(event) =>
                    !use_default_params &&
                    set_parameter_overrides((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                  placeholder={key.toUpperCase()}
                  readOnly={use_default_params}
                  required={script_type === "printing" && key === "p6"}
                />
              </label>
            ))}
          </div>

          <div className="full">
            <p className="helper">Cycle types</p>
            <div className="select-all-row">
              <button className="secondary-button" type="button" onClick={handle_select_all}>
                {log_types.length === cycle_types.length ? "Clear All" : "Select All Cycle Types"}
              </button>
            </div>
            <div className="checkbox-grid">
              {cycle_types.map((value) => (
                <label key={value} className="checkbox-pill">
                  <input type="checkbox" checked={log_types.includes(value)} onChange={() => handle_script_toggle(value)} />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={generating}>
              {generating ? "Generating…" : "Generate Scripts"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                download_export("/scripts/export", {
                  billing_cycle_id: String(cycle.id),
                  environment,
                  script_type,
                })
              }
            >
              Export Grouped File
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => download_export("/scripts/export-all", { billing_cycle_id: String(cycle.id) })}
            >
              Export All Scripts
            </button>
          </div>
          {last_generated_count !== null ? (
            <div className="alert info full">Generated {last_generated_count} scripts for the selected run.</div>
          ) : null}
        </form>
      )}

      <div className="panel-subheader">
        <h3>Run Tracking</h3>
        <p>Mark each script executed or failed as it completes on the billing host.</p>
      </div>
      <div className="data-table">
        <div className="data-row table-head runs">
          <span>Cycle Type</span>
          <span>Script</span>
          <span>Status</span>
          <span>Executed</span>
          <span>Execution Issues</span>
        </div>
        {stage_scripts.length === 0 ? (
          <div className="empty-state">
            No {environment} scripts yet. {can_operate ? "Generate them above to start tracking runs." : ""}
          </div>
        ) : (
          stage_scripts.map((script) => {
            const run = runs_by_script_id.get(String(script.id))
            const current_status = run?.status || "planned"
            const run_issues = run ? execution_issues_by_run_id.get(String(run.id)) || [] : []
            return (
              <div className="data-row runs" key={script.id}>
                <span>{script.log_type}</span>
                <span className="capitalize">{script.script_type}</span>
                <select
                  className={`select-inline status-select ${current_status}`}
                  value={current_status}
                  onChange={(event) => handle_run_status_change(String(script.id), event.target.value)}
                  disabled={!can_operate}
                  aria-label={`Run status for ${script.log_type} ${script.script_type}`}
                >
                  <option value="planned">Planned</option>
                  <option value="executed">Executed</option>
                  <option value="failed">Failed</option>
                </select>
                <span>{run?.run_timestamp ? new Date(run.run_timestamp).toLocaleString() : "-"}</span>
                <span className="stacked-cell">
                  {run_issues.length > 0 && (
                    <button
                      type="button"
                      className="bg-transparent p-0 text-left"
                      onClick={() => set_active_execution_issue(run_issues[0])}
                      aria-label={`View ${run_issues.length} logged execution issue(s) for ${script.log_type} ${script.script_type}`}
                    >
                      <Badge variant="warning">{run_issues.length} logged</Badge>
                    </button>
                  )}
                  {can_operate && run && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set_issue_dialog_run(run)}
                    >
                      Log Execution Issue
                    </Button>
                  )}
                </span>
              </div>
            )
          })
        )}
      </div>

      <ExecutionIssueDialog
        open={Boolean(issue_dialog_run)}
        onOpenChange={(value) => !value && set_issue_dialog_run(null)}
        cycle_id={cycle.id}
        run_id={issue_dialog_run?.id}
        run_label={`this ${environment} run`}
        on_created={reload_execution_issues}
      />
      <IssueActivityDialog
        open={Boolean(active_execution_issue)}
        onOpenChange={(value) => !value && set_active_execution_issue(null)}
        issue={active_execution_issue}
        classification_name={
          active_execution_issue ? execution_classifications_by_id.get(active_execution_issue.classification_id) : undefined
        }
        can_manage={false}
        test_approved={false}
        on_changed={reload_execution_issues}
      />

      {stage_scripts.length > 0 && (
        <>
          <div className="panel-subheader">
            <h3>Generated Commands</h3>
            <p>The exact commands produced for this cycle and environment.</p>
          </div>
          <div className="space-y-2">
            {stage_scripts.map((script) => (
              <div className="command-shell" key={`cmd-${script.id}`}>
                <div className="command-meta">
                  <StatusBadge status={script.environment} className="capitalize" />
                  <span className="pill neutral">{script.script_type}</span>
                  <span className="pill neutral">{script.log_type}</span>
                </div>
                <pre className="command-output mono">{script.command_text}</pre>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
