import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { api_base_url, api_fetch, get_auth_token } from "../../api"
import { show_toast, useAppData } from "../../context/AppDataContext"
import { StatusBadge } from "../../components/billing/StatusBadge"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { PanelSubheader, PanelSubheaderTitle, PanelSubheaderDescription } from "../../components/ui/panel"
import { DataTable, DataTableRow } from "../../components/ui/data-table"
import { EmptyState } from "../../components/ui/empty-state"
import { InfoTip } from "../../components/ui/info-tip"
import { build_default_parameters, cycle_types } from "../../lib/format"
import { ExecutionIssueDialog } from "../issues/ExecutionIssueDialog"
import { IssueActivityDialog } from "../issues/IssueActivityDialog"
import { list_finance_issues, list_issue_classifications } from "../issues/issue-api"

const SCRIPT_TYPE_TIP =
  "Preparation scripts run the Cerillion bill-generation job for this cycle. Printing scripts run the bill-printing job, and need a completed preparation run's billing run UID (P6) to work."

const CYCLE_TYPE_TIP =
  "The Cerillion bill cycle code each script is generated for (for example A1A covers Seychelles-currency payer accounts and A1U covers USD payer accounts). Select every cycle type this run should cover."

/* Mirrors backend/app/schemas/scripts.py ScriptGenerateRequest and the p6
   requirement enforced in backend/app/services/command_service.py's
   generate_parameters - client validation only surfaces that check earlier. */
const script_generate_schema = z
  .object({
    script_type: z.enum(["preparation", "printing"]),
    use_default_params: z.boolean(),
    p1: z.string(),
    p2: z.string(),
    p3: z.string(),
    p4: z.string(),
    p5: z.string(),
    p6: z.string(),
    p7: z.string(),
    p8: z.string(),
    log_types: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    const p6_value = data.use_default_params ? "" : data.p6
    if (data.script_type === "printing" && !p6_value.trim()) {
      ctx.addIssue({
        path: ["p6"],
        code: z.ZodIssueCode.custom,
        message: 'Printing scripts require a billing run UID (P6). Uncheck "Use default parameters" and enter it.',
      })
    }
  })

/* One/two-sentence explanations grounded in command_service.py's parameter-building
   functions and docs/platform/billing_process.md §3.1-3.2. Returns null when the
   field's exact meaning could not be confidently traced to either source. */
const parameter_tip = (key, script_type) => {
  if (script_type === "printing") {
    return {
      p2: "Packs three settings together: PBCC is this run's bill cycle code and PTEST marks whether it's a test or production run. PITM is a fixed flag the script always expects.",
      p3: "Start of the billing period being printed - the first day of the usage month.",
      p4: "End of the billing period being printed - the last day of the usage month.",
      p6: "The billing run UID from the completed bill-generation run this print job belongs to. Required - printing cannot proceed without it.",
    }[key] ?? null
  }
  return {
    p1: "The billing cycle code this run applies to (the same code you're generating scripts for).",
    p2: "Whether this is a test run (T) or a production run (N), set automatically from the environment you're working in.",
    p3: "The run date and time the bill-generation script uses; defaults to the first day of the month after the usage month.",
    p6: "Not used for preparation scripts; only relevant when generating printing scripts.",
    p7: "Not used for preparation scripts; only relevant when generating printing scripts.",
    p8: "Not used for preparation scripts; only relevant when generating printing scripts.",
  }[key] ?? null
}

/* One stage = script generation + run tracking for a single cycle+environment.
   The cycle and environment are fixed by the workspace; no re-selection. */
export function ScriptsRunsStage({ cycle, environment, blocked, blocked_reason }) {
  const { role, scripts, runs_by_script_id, reload_all, set_error_message } = useAppData()
  const can_operate = role === "billing_user" || role === "system_admin"

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(script_generate_schema),
    mode: "onBlur",
    defaultValues: {
      script_type: "preparation",
      use_default_params: true,
      p1: "", p2: "", p3: "", p4: "", p5: "", p6: "", p7: "", p8: "",
      log_types: [],
    },
  })
  const script_type = watch("script_type")
  const use_default_params = watch("use_default_params")
  const log_types = watch("log_types")
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
      const defaults = build_default_parameters(script_type, environment, cycle_month)
      for (const key of Object.keys(defaults)) {
        setValue(key, defaults[key], { shouldValidate: false })
      }
    }
  }, [use_default_params, script_type, environment, cycle_month, setValue])

  const stage_scripts = useMemo(
    () =>
      scripts.filter(
        (script) => String(script.billing_cycle_id) === String(cycle.id) && script.environment === environment
      ),
    [scripts, cycle, environment]
  )

  const handle_script_toggle = (value) => {
    setValue(
      "log_types",
      log_types.includes(value) ? log_types.filter((item) => item !== value) : [...log_types, value],
      { shouldValidate: true }
    )
  }

  const handle_select_all = () => {
    setValue("log_types", log_types.length === cycle_types.length ? [] : [...cycle_types], { shouldValidate: true })
  }

  const on_generate_valid = async (data) => {
    try {
      set_generating(true)
      const parameter_overrides = { p1: data.p1, p2: data.p2, p3: data.p3, p4: data.p4, p5: data.p5, p6: data.p6, p7: data.p7, p8: data.p8 }
      const overrides = data.use_default_params
        ? parameter_overrides.p6
          ? { p6: parameter_overrides.p6 }
          : undefined
        : Object.fromEntries(Object.entries(parameter_overrides).filter(([, value]) => value !== ""))
      const payload = {
        billing_cycle_id: String(cycle.id),
        environment,
        script_type: data.script_type,
        log_types: data.log_types,
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

  const on_generate_invalid = () => {
    const first_error_key = Object.keys(errors)[0]
    const target = document.querySelector(
      first_error_key ? `[name="${first_error_key}"]` : "#script-generate-error-summary"
    )
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
    target?.focus?.()
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
        <form className="form-grid" onSubmit={handleSubmit(on_generate_valid, on_generate_invalid)} noValidate>
          {Object.keys(errors).length > 0 && (
            <div id="script-generate-error-summary" className="alert warning full" role="alert" tabIndex={-1}>
              <p>Fix the following before generating scripts:</p>
              <ul className="list-disc pl-5">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
          <label>
            <span className="inline-flex items-center gap-1.5">
              Script type
              <InfoTip label="Script type info">{SCRIPT_TYPE_TIP}</InfoTip>
            </span>
            <select {...register("script_type")}>
              <option value="preparation">Preparation</option>
              <option value="printing">Printing</option>
            </select>
          </label>
          <label className="full">
            <div className="toggle-row">
              <input type="checkbox" {...register("use_default_params")} />
              <span>Use default parameters</span>
            </div>
          </label>
          <div className="parameter-grid">
            {["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((key) => {
              const tip = parameter_tip(key, script_type)
              return (
              <label key={key} className={use_default_params ? "is-read-only" : ""}>
                <span className="inline-flex items-center gap-1.5">
                  {key.toUpperCase()}
                  {tip && <InfoTip label={`${key.toUpperCase()} info`}>{tip}</InfoTip>}
                </span>
                <input
                  {...register(key)}
                  placeholder={key.toUpperCase()}
                  readOnly={use_default_params}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                />
                {errors[key] && (
                  <span id={`${key}-error`} className="text-destructive text-sm" role="alert">
                    {errors[key].message}
                  </span>
                )}
              </label>
              )
            })}
          </div>

          <div className="full">
            <p className="helper inline-flex items-center gap-1.5">
              Cycle types
              <InfoTip label="Cycle types info">{CYCLE_TYPE_TIP}</InfoTip>
            </p>
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

      <PanelSubheader>
        <PanelSubheaderTitle>Run Tracking</PanelSubheaderTitle>
        <PanelSubheaderDescription>Mark each script executed or failed as it completes on the billing host.</PanelSubheaderDescription>
      </PanelSubheader>
      <DataTable>
        <DataTableRow variant="runs" head>
          <span>Cycle Type</span>
          <span>Script</span>
          <span>Status</span>
          <span>Executed</span>
          <span>Execution Issues</span>
        </DataTableRow>
        {stage_scripts.length === 0 ? (
          <EmptyState>
            No {environment} scripts yet. {can_operate ? "Generate them above to start tracking runs." : ""}
          </EmptyState>
        ) : (
          stage_scripts.map((script) => {
            const run = runs_by_script_id.get(String(script.id))
            const current_status = run?.status || "planned"
            const run_issues = run ? execution_issues_by_run_id.get(String(run.id)) || [] : []
            return (
              <DataTableRow variant="runs" key={script.id}>
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
              </DataTableRow>
            )
          })
        )}
      </DataTable>

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
          <PanelSubheader>
            <PanelSubheaderTitle>Generated Commands</PanelSubheaderTitle>
            <PanelSubheaderDescription>The exact commands produced for this cycle and environment.</PanelSubheaderDescription>
          </PanelSubheader>
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
