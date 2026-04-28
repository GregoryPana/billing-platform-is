import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import html2pdf from "html2pdf.js"
import {
  BookOpen, LayoutDashboard, RefreshCcw, FileCode2, Play,
  CheckCircle, Settings, Bell, ClipboardList, FileText, Shield
} from "lucide-react"


import { api_base_url, api_fetch, get_auth_token, set_auth_token } from "./api"
import { cn } from "./lib/utils"
import billingProcessDoc from "../../docs/platform/billing_process.md?raw"

import billingUserGuideDoc from "../../docs/platform/billing_user_guide.md?raw"
import financeUserGuideDoc from "../../docs/platform/finance_user_guide.md?raw"
import billingProcessPdf from "../../docs/platform/Billing Process.pdf"
import "./App.css"

const nav_items = [
  { id: "user-guide", label: "User Guide", icon: BookOpen },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cycles", label: "Billing Cycles", icon: RefreshCcw },
  { id: "scripts", label: "Script Generation", icon: FileCode2 },
  { id: "runs", label: "Runs Tracking", icon: Play },
  { id: "approvals", label: "Approvals", icon: CheckCircle },
  { id: "request-settings", label: "Request Settings", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
  { id: "documentation", label: "View Documentation", icon: FileText },
  { id: "admin", label: "Admin", icon: Shield },
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
  const firstOfNextMonth = new Date(year, month, 1)
  const format = (date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `${yyyy}_${mm}_${dd} 00:00:00`
  }
  return { first: format(first), last: format(last), firstOfNextMonth: format(firstOfNextMonth) }
}

const format_input_date = (value = new Date()) => {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, "0")
  const dd = String(value.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const download_text_file = (filename, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}


const format_cycle_status = (status) => {
  if (!status) {
    return "-"
  }
  if (status === "draft") {
    return "Test Run Phase"
  }
  if (status === "test_approved") {
    return "Live Run Phase"
  }
  if (status === "live_approved") {
    return "Notification Phase"
  }
  if (status === "post_live_approved") {
    return "Completed"
  }
  return status
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
    p3: bounds?.firstOfNextMonth || "YYYY_MM_DD 00:00:00",
    p4: "28",
    p5: "2",
    p6: "",
    p7: "",
    p8: "",
  }
}

const safe_parse_metadata = (value) => {
  if (!value) {
    return {}
  }
  if (typeof value === "object") {
    return value
  }
  if (typeof value !== "string") {
    return {}
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const format_audit_result = (entry, metadata) => {
  const explicit = metadata.status || metadata.decision || entry.status
  if (explicit) {
    return String(explicit)
  }
  const action = String(entry.action || "")
  if (action.startsWith("create_") || action.startsWith("generate_") || action.startsWith("export_")) {
    return "success"
  }
  if (action.includes("reject")) {
    return "rejected"
  }
  if (action.includes("approve")) {
    return "approved"
  }
  if (action === "approval_requested") {
    return "pending"
  }
  if (action === "send_notification") {
    return "sent"
  }
  return "-"
}

const format_audit_action_label = (action, actor_type) => {
  if (!action) {
    return "-"
  }
  const base = String(action).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  
  const actor_desc = actor_type === "billing" ? "by Billing" : actor_type === "finance" ? "by Finance" : actor_type === "admin" ? "by Admin" : ""
  
  const friendly = {
    "create cycle": `Created billing cycle ${actor_desc}`,
    "generate script": `Generated scripts ${actor_desc}`,
    "execute run": `Marked run as executed ${actor_desc}`,
    "mark run executed": `Marked run as executed ${actor_desc}`,
    "request approval": `Requested approval ${actor_desc}`,
    "approve": `Approved ${actor_desc}`,
    "reject": `Rejected ${actor_desc}`,
    "send notification": `Sent notification ${actor_desc}`,
    "update settings": `Updated settings ${actor_desc}`,
    "export script": `Exported scripts ${actor_desc}`,
    "create user": `Created user ${actor_desc}`,
    "update user": `Updated user ${actor_desc}`,
    "delete user": `Deleted user ${actor_desc}`,
    "login": `Logged in`,
    "logout": `Logged out`,
  }
  
  const key = String(action).toLowerCase()
  for (const [pattern, label] of Object.entries(friendly)) {
    if (key.includes(pattern)) {
      return label
    }
  }
  return base
}

function App() {
  const [is_authenticated, set_is_authenticated] = useState(false)
  const [login_form, set_login_form] = useState({
    username_or_email: "",
    password: "",
  })
  const [show_login_password, set_show_login_password] = useState(false)
  const [login_errors, set_login_errors] = useState({
    username: "",
    password: "",
  })
  const [signup_form, set_signup_form] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  })
  const [auth_mode, set_auth_mode] = useState("login")
  const [current_user, set_current_user] = useState(null)
  const [signup_status, set_signup_status] = useState("")
  const [active_view, set_active_view] = useState("user-guide")
  const [role, set_role] = useState("viewer")
  const [cycles, set_cycles] = useState([])
  const [scripts, set_scripts] = useState([])
  const [runs, set_runs] = useState([])
  const [approvals, set_approvals] = useState([])
  const [notifications, set_notifications] = useState([])
  const [audit_logs, set_audit_logs] = useState([])
  const [users, set_users] = useState([])
  const [signup_requests, set_signup_requests] = useState([])
  const [error_message, set_error_message] = useState("")
  const [expanded_approval_id, set_expanded_approval_id] = useState(null)

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
  const [approval_request_feedback, set_approval_request_feedback] = useState("")
  const [approval_request_pending, set_approval_request_pending] = useState(false)
  const [request_settings, set_request_settings] = useState({
    requester_name: "",
    billing_email: "information-system@cwseychelles.com",
    default_message: "",
  })
  const default_message_ref = useRef("")
  const request_settings_loaded = useRef(false)
  const user_guide_ref = useRef(null)
  const [request_settings_status, set_request_settings_status] = useState("")
  const [finance_recipient_input, set_finance_recipient_input] = useState("")
  const [finance_recipients, set_finance_recipients] = useState([])
  const [selected_finance_recipients, set_selected_finance_recipients] = useState([])
  const [recipient_error, set_recipient_error] = useState("")
  const [notification_form, set_notification_form] = useState({
    billing_cycle_id: "",
    notification_date: format_input_date(),
  })
  const [last_notification_command, set_last_notification_command] = useState(null)
  const [admin_user_form, set_admin_user_form] = useState({
    name: "",
    username: "",
    email: "",
    role: "billing",
    password: "",
    is_active: true,
  })
  const [admin_edit_user, set_admin_edit_user] = useState(null)
  const [admin_edit_form, set_admin_edit_form] = useState({
    name: "",
    username: "",
    email: "",
    role: "billing",
    password: "",
    is_active: true,
  })
  const [signup_role_selection, set_signup_role_selection] = useState({})
  const [run_environment, set_run_environment] = useState("test")
  const [run_cycle_id, set_run_cycle_id] = useState("")
  const [run_script_type, set_run_script_type] = useState("preparation")
  const [run_status_overrides, set_run_status_overrides] = useState({})
  const [approval_notifications, set_approval_notifications] = useState([])
  const [last_generated_count, set_last_generated_count] = useState(null)
  const [toast, set_toast] = useState(null)
  const documentation_sets = useMemo(
    () => [
      {
        id: "billing-process",
        label: "Billing Process",
        content: billingProcessDoc,
        pdf: billingProcessPdf,
      },
    ],
    []
  )
  const [active_documentation_id, set_active_documentation_id] = useState("billing-process")

  useEffect(() => {
    if (!toast) {
      return undefined
    }
    const timer = setTimeout(() => set_toast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  const show_toast = (message, tone = "info") => {
    set_toast({ id: Date.now(), message, tone })
  }

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
        value: `${notifications.length} commands`,
        tone: "info",
      },
    ]
  }, [approvals, cycles, notifications])

  useEffect(() => {
    const cycle = cycles.find((item) => String(item.id) === script_form.billing_cycle_id)
    const cycle_month = cycle?.billing_month || cycle?.usage_month || ""
    const defaults = build_default_parameters(
      script_form.script_type,
      script_form.environment,
      cycle_month
    )
    
    if (use_default_params) {
      set_parameter_overrides(defaults)
    }
  }, [use_default_params, script_form.script_type, script_form.environment, cycles, script_form.billing_cycle_id])

const CycleProgressTracker = ({ cycle, scripts = [], runs = [], approvals = [] }) => {
  if (!cycle) return null
  const scripts_by_id = new Map(scripts.map(s => [String(s.id), s]))
  const cycle_id = String(cycle.id)
  const cycle_label = `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
  const cycle_scripts = scripts.filter(s => String(s.billing_cycle_id) === cycle_id)
  
  const has_script = (env, type) => cycle_scripts.some(s => s.environment === env && s.script_type === type)
  const has_executed = (env) => runs.some(r => {
    const s = scripts_by_id.get(String(r.script_definition_id))
    return s && String(s.billing_cycle_id) === cycle_id && s.environment === env && r.status === "executed"
  })
  
  const get_approval = (stage) => approvals.find(a => String(a.billing_cycle_id) === cycle_id && a.stage === stage)
  
  const steps = [
    { label: "Created", done: true },
    { label: "Test Scripts", done: has_script("test", "preparation") || has_script("test", "printing") },
    { label: "Test Runs", done: has_executed("test") },
    { label: "Approval (Test)", done: get_approval("test")?.status === "approved", rejected: get_approval("test")?.status === "rejected" },
    { label: "Live Scripts", done: has_script("live", "preparation") || has_script("live", "printing") },
    { label: "Live Runs", done: has_executed("live") },
    { label: "Approval (Live)", done: get_approval("live")?.status === "approved" || get_approval("post_live")?.status === "approved", rejected: get_approval("live")?.status === "rejected" },
    { label: "Closed", done: cycle.status === "closed" },
  ]

  const progress = Math.round((steps.filter(s => s.done).length / steps.length) * 100)
  const completed_steps = steps.filter((step) => step.done).length
  const connector_progress = Math.max(
    0,
    Math.min(100, ((completed_steps - 1) / (steps.length - 1)) * 100)
  )
  const has_rejection = steps.some((step) => step.rejected)
  const is_complete = progress === 100
  const progress_bar_tone = has_rejection ? "danger" : is_complete ? "success" : "warning"

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm mb-10 overflow-hidden border-l-4",
        progress_bar_tone === "danger"
          ? "border-l-red-500"
          : progress_bar_tone === "success"
          ? "border-l-green-500"
          : "border-l-yellow-500"
      )}
    >
      <div className="p-8 border-b bg-muted/20">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1">{cycle_label}</h2>
            <p className="text-sm text-muted-foreground">Workflow progression for local billing cycle</p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                progress_bar_tone === "danger"
                  ? "text-red-600"
                  : progress_bar_tone === "success"
                  ? "text-green-600"
                  : "text-yellow-600"
              )}
            >
              {progress}%
            </span>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Completion</p>
          </div>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-in-out bg-gradient-to-r",
              progress_bar_tone === "danger"
                ? "from-red-500 to-red-600"
                : progress_bar_tone === "success"
                ? "from-green-500 to-green-600"
                : "from-yellow-400 to-amber-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="p-8 relative">
        <div className="hidden md:block absolute left-10 right-10 top-[1.55rem] h-[6px] rounded-full bg-gradient-to-r from-blue-100 via-indigo-100 to-cyan-100" />
        <div
          className={cn(
            "hidden md:block absolute left-10 top-[1.55rem] h-[6px] rounded-full transition-all duration-700 shadow-[0_0_18px_rgba(59,130,246,0.35)]",
            progress_bar_tone === "danger"
              ? "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500"
              : progress_bar_tone === "success"
              ? "bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500"
              : "bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500"
          )}
          style={{ width: `calc((100% - 5rem) * ${connector_progress / 100})` }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 relative">
          {steps.map((step, i) => {
            const is_current = i === completed_steps && !step.done && !step.rejected

            return (
              <div key={i} className="relative z-10 flex flex-col items-center gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-all duration-300 shadow-md",
                    step.rejected
                      ? "bg-gradient-to-br from-rose-50 to-red-100 border-red-500 text-red-700"
                      : step.done
                      ? "bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 border-blue-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.45)]"
                      : is_current
                      ? "bg-gradient-to-br from-yellow-50 to-amber-100 border-amber-500 text-amber-700 ring-4 ring-amber-100"
                      : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-slate-600"
                  )}
                >
                  {step.rejected ? <Shield size={15} /> : step.done ? <Play size={14} fill="currentColor" /> : <span>{i + 1}</span>}
                </div>

                <p
                  className={cn(
                    "text-[11px] md:text-[12px] font-bold uppercase tracking-tight text-center leading-4 max-w-[96px]",
                    step.rejected
                      ? "text-red-700"
                      : step.done
                      ? "text-blue-900"
                      : is_current
                      ? "text-amber-700"
                      : "text-slate-700"
                  )}
                >
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



  const visible_nav_items = useMemo(() => {
    const role_permissions = {
      billing: [
        "user-guide",
        "overview",
        "cycles",
        "scripts",
        "runs",
        "approvals",
        "request-settings",
        "notifications",
        "documentation",
      ],
      finance: ["user-guide", "overview", "approvals"],
      admin: [
        "user-guide",
        "overview",
        "cycles",
        "scripts",
        "runs",
        "approvals",
        "request-settings",
        "notifications",
        "audit",
        "documentation",
        "admin",
      ],
      viewer: ["user-guide", "overview", "runs", "approvals", "request-settings", "documentation"],
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
          api_fetch("/cycles/"),
          api_fetch("/scripts/"),
          api_fetch("/runs/"),
          api_fetch("/approvals/"),
          api_fetch("/notifications/"),
          api_fetch("/audit/"),
        ])
      set_cycles(cycles_data)
      set_scripts(scripts_data)
      set_runs(runs_data)
      set_approvals(approvals_data)
      set_notifications(notifications_data)
      set_audit_logs(audit_data)

      if (role === "admin") {
        const [users_data, signup_data] = await Promise.all([
          api_fetch("/users/"),
          api_fetch("/auth/requests"),
        ])
        set_users(users_data)
        set_signup_requests(signup_data)
      } else {
        set_users([])
        set_signup_requests([])
      }
    } catch (error) {
      set_error_message(error.message)
    }
  }, [role])

  useEffect(() => {
    if (!is_authenticated || (role !== "billing" && role !== "admin")) {
      return
    }
    const load_settings = async () => {
      try {
        const settings = await api_fetch("/approvals/settings")
        set_request_settings({
          requester_name: current_user?.name || "",
          billing_email: settings.billing_email || "information-system@cwseychelles.com",
          default_message: settings.default_message || "",
        })
        set_finance_recipients(Array.isArray(settings.finance_recipients) ? settings.finance_recipients : [])
        request_settings_loaded.current = true
      } catch (error) {
        set_error_message(error.message)
      }
    }
    load_settings()
  }, [is_authenticated, role, current_user])

  useEffect(() => {
    if (!current_user?.name) {
      return
    }
    set_request_settings((previous) => ({
      ...previous,
      requester_name: current_user.name,
    }))
  }, [current_user])

  useEffect(() => {
    if (!request_settings_loaded.current) {
      return
    }
    const timer = setTimeout(async () => {
      try {
        await api_fetch("/approvals/settings", {
          method: "PUT",
          body: JSON.stringify({
            billing_email: request_settings.billing_email,
            default_message: request_settings.default_message,
            finance_recipients,
          }),
        })
        set_request_settings_status("Settings saved.")
      } catch (error) {
        set_request_settings_status("Failed to save settings.")
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [request_settings, finance_recipients])

  useEffect(() => {
    const previous_default = default_message_ref.current
    const current_default = request_settings.default_message
    if (current_default) {
      const should_sync =
        !approval_request_form.comments || approval_request_form.comments === previous_default
      if (should_sync) {
        set_approval_request_form((previous) => ({
          ...previous,
          comments: current_default,
        }))
      }
    }
    default_message_ref.current = current_default
  }, [approval_request_form.comments, request_settings.default_message])

  useEffect(() => {
    if (selected_finance_recipients.length > 0 && recipient_error) {
      set_recipient_error("")
    }
  }, [recipient_error, selected_finance_recipients])

  useEffect(() => {
    if (approval_request_feedback) {
      set_approval_request_feedback("")
    }
  }, [approval_request_form.billing_cycle_id, approval_request_form.stage])

  useEffect(() => {
    if (!is_authenticated) {
      return
    }
    reload_all()
    const interval = setInterval(reload_all, 30000)
    return () => clearInterval(interval)
  }, [is_authenticated, reload_all])

  useEffect(() => {
    const token = get_auth_token()
    if (!token) {
      return
    }
    const load_user = async () => {
      try {
        const me = await api_fetch("/auth/me")
        set_current_user(me)
        set_role(me.role)
        set_is_authenticated(true)
      } catch (error) {
        set_auth_token(null)
        set_is_authenticated(false)
      }
    }
    load_user()
  }, [])

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
      set_active_view("user-guide")
    }
  }, [active_view, visible_nav_items])

  const handle_cycle_submit = async (event) => {
    event.preventDefault()
    try {
      await api_fetch("/cycles/", { method: "POST", body: JSON.stringify(cycle_form) })
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
      const created = await api_fetch("/scripts/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      set_last_generated_count(Array.isArray(created) ? created.length : null)
      show_toast("Scripts generated successfully.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Failed to generate scripts.", "error")
    }
  }

  const handle_export = async () => {
    if (!script_form.billing_cycle_id) {
      set_error_message("Select a billing cycle before exporting.")
      return
    }
    try {
      const export_record = await api_fetch("/scripts/export", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle_id: script_form.billing_cycle_id,
          environment: script_form.environment,
          script_type: script_form.script_type,
        }),
      })
      const token = get_auth_token()
      const response = await fetch(
        `${api_base_url}/scripts/exports/${export_record.id}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
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
      const export_record = await api_fetch("/scripts/export-all", {
        method: "POST",
        body: JSON.stringify({
          billing_cycle_id: script_form.billing_cycle_id,
        }),
      })
      const token = get_auth_token()
      const response = await fetch(
        `${api_base_url}/scripts/exports/${export_record.id}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
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
      await api_fetch("/approvals/", { method: "POST", body: JSON.stringify(approval_form) })
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

  const handle_login_submit = async (event) => {
    event.preventDefault()
    try {
      set_error_message("")
      set_login_errors({ username: "", password: "" })
      const login_identifier = login_form.username_or_email.trim()
      if (login_identifier.includes("@") && !is_valid_email(login_identifier)) {
        set_login_errors({
          username: "Enter a valid email address or use your username instead.",
          password: "",
        })
        return
      }
      const response = await api_fetch(
        "/auth/login",
        { method: "POST", body: JSON.stringify(login_form) },
        false
      )
      set_auth_token(response.access_token)
      set_current_user(response.user)
      set_role(response.user.role)
      set_signup_status("")
      set_is_authenticated(true)
      set_active_view("overview")
    } catch (error) {
      const message = error?.message || "Sign in failed"
      if (message.includes("Invalid credentials") || message.includes("invalid credentials")) {
        set_login_errors({ username: "", password: "Incorrect username/email or password." })
        set_error_message("")
        return
      }
      set_error_message(message)
    }
  }

  const handle_signup_submit = async (event) => {
    event.preventDefault()
    try {
      set_error_message("")
      const response = await api_fetch(
        "/auth/signup",
        { method: "POST", body: JSON.stringify(signup_form) },
        false
      )
      set_signup_status(
        `Request submitted for ${response.username}. Admin has been notified and will review shortly.`
      )
      set_auth_mode("login")
      set_signup_form({ name: "", username: "", email: "", password: "" })
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_approval_request_submit = async (event) => {
    event.preventDefault()
    try {
      set_error_message("")
      set_approval_request_feedback("")
      set_approval_request_pending(true)
      if (selected_finance_recipients.length === 0) {
        set_recipient_error("Select at least one finance recipient.")
        set_approval_request_pending(false)
        return
      }
      if (!current_user?.name || !request_settings.billing_email) {
        set_recipient_error("Add the billing email in Request Settings.")
        set_approval_request_pending(false)
        return
      }
      set_recipient_error("")
      await api_fetch("/approvals/request", { method: "POST", body: JSON.stringify({
        ...approval_request_form,
        recipients: selected_finance_recipients,
        app_link: window.location.href
      }) })
      set_approval_request_form({
        billing_cycle_id: "",
        stage: "test",
        comments: request_settings.default_message || "",
      })
      set_approval_request_feedback("Approval request sent to finance and recorded in the system.")
      show_toast("Approval request sent to selected recipients.", "success")
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
      show_toast(error.message || "Failed to send approval request.", "error")
    } finally {
      set_approval_request_pending(false)
    }
  }

  const handle_run_stage_request = () => {
    if (!run_cycle_id) {
      return
    }
    set_approval_request_form((previous) => ({
      ...previous,
      billing_cycle_id: run_cycle_id,
      stage: run_stage,
    }))
    set_active_view("approvals")
  }

  const handle_admin_user_create = async (event) => {
    event.preventDefault()
    try {
      await api_fetch("/users/", { method: "POST", body: JSON.stringify(admin_user_form) })
      set_admin_user_form({
        name: "",
        username: "",
        email: "",
        role: "billing",
        password: "",
        is_active: true,
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_admin_user_update = async (event) => {
    event.preventDefault()
    if (!admin_edit_user) {
      return
    }
    try {
      await api_fetch(`/users/${admin_edit_user.id}`, {
        method: "PATCH",
        body: JSON.stringify(admin_edit_form),
      })
      set_admin_edit_user(null)
      set_admin_edit_form({
        name: "",
        username: "",
        email: "",
        role: "billing",
        password: "",
        is_active: true,
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_admin_user_delete = async (user_id) => {
    try {
      await api_fetch(`/users/${user_id}`, { method: "DELETE" })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_signup_approve = async (request_id) => {
    const selected_role = signup_role_selection[request_id] || "billing"
    try {
      await api_fetch(`/auth/requests/${request_id}/approve`, {
        method: "POST",
        body: JSON.stringify({ role: selected_role }),
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_signup_reject = async (request_id) => {
    try {
      await api_fetch(`/auth/requests/${request_id}/reject`, { method: "POST" })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const normalize_email = (value) => value.trim().toLowerCase()
  const is_valid_email = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)

  const handle_add_finance_recipient = () => {
    const normalized = normalize_email(finance_recipient_input)
    if (!normalized) {
      set_recipient_error("Enter a finance email address to add.")
      return
    }
    if (!is_valid_email(normalized)) {
      set_recipient_error("Enter a valid email address.")
      return
    }
    set_recipient_error("")
    set_finance_recipients((previous) =>
      previous.includes(normalized) ? previous : [...previous, normalized]
    )
    set_selected_finance_recipients((previous) =>
      previous.includes(normalized) ? previous : [...previous, normalized]
    )
    set_finance_recipient_input("")
    show_toast("Finance recipient added.", "success")
  }

  const toggle_finance_recipient = (email) => {
    set_selected_finance_recipients((previous) =>
      previous.includes(email) ? previous.filter((item) => item !== email) : [...previous, email]
    )
  }

  const remove_finance_recipient = (email) => {
    set_finance_recipients((previous) => previous.filter((item) => item !== email))
    set_selected_finance_recipients((previous) => previous.filter((item) => item !== email))
    show_toast("Finance recipient removed.", "info")
  }

  const handle_notification_submit = async (event) => {
    event.preventDefault()
    try {
      const response = await api_fetch("/notifications/", {
        method: "POST",
        body: JSON.stringify(notification_form),
      })
      set_notification_form({ billing_cycle_id: "", notification_date: format_input_date() })
      set_last_notification_command({
        message: response.message,
        billing_cycle_id: response.billing_cycle_id,
        notification_date: notification_form.notification_date,
      })
      await reload_all()
    } catch (error) {
      set_error_message(error.message)
    }
  }

  const handle_user_guide_pdf = async () => {
    if (!user_guide_ref.current) {
      return
    }
    const filename = `billing_user_guide_${format_input_date()}.pdf`
    document.body.classList.add("pdf-export")
    try {
      await html2pdf()
        .set({
          margin: [10, 10, 12, 10],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(user_guide_ref.current)
        .save()
    } finally {
      document.body.classList.remove("pdf-export")
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
        await api_fetch("/runs/", {
          method: "PATCH",
          body: JSON.stringify({
            script_run_id: run.id,
            status,
            notes: run.notes || "",
          }),
        })
      } else {
        await api_fetch("/runs/", {
          method: "POST",
          body: JSON.stringify({
            script_definition_id: script_id,
            status,
            notes: "",
          }),
        })
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
      return []
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
  const approval_recipients_missing = selected_finance_recipients.length === 0
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
  const pending_signup_requests = useMemo(
    () => signup_requests.filter((request) => request.status === "pending"),
    [signup_requests]
  )
  const handled_signup_requests = useMemo(
    () => signup_requests.filter((request) => request.status !== "pending"),
    [signup_requests]
  )

  if (!is_authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-[440px] bg-card border rounded-2xl shadow-xl p-10 flex flex-col gap-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-primary">Billing Platform</h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium tracking-tight">B2B Automations & Governance</p>
          </div>
          
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-bold tracking-tight">
              {auth_mode === "login" ? "Sign in to account" : "Request access"}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {auth_mode === "login" ? "Enter your core credentials to continue." : "Admin approval is required for all new accounts."}
            </p>
          </div>

          {error_message && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
              {error_message}
            </div>
          )}
          {signup_status && (
            <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              {signup_status}
            </div>
          )}

          <form className="grid gap-6" onSubmit={auth_mode === "login" ? handle_login_submit : handle_signup_submit}>
            {auth_mode === "signup" && (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="John Doe"
                    value={signup_form.name}
                    onChange={(e) => set_signup_form({ ...signup_form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Username</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="jdoe123"
                    value={signup_form.username}
                    onChange={(e) => set_signup_form({ ...signup_form, username: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="grid gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email or User</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="text"
                placeholder="name@cwseychelles.com"
                value={auth_mode === "login" ? login_form.username_or_email : signup_form.email}
                onChange={(e) => auth_mode === "login" 
                  ? set_login_form({ ...login_form, username_or_email: e.target.value })
                  : set_signup_form({ ...signup_form, email: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                {auth_mode === "login" && (
                   <button 
                    type="button"
                    onClick={() => set_show_login_password(!show_login_password)}
                    className="text-[10px] font-bold text-primary hover:underline uppercase"
                  >
                    {show_login_password ? "Hide" : "Show"}
                  </button>
                )}
              </div>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type={auth_mode === "login" && show_login_password ? "text" : "password"}
                value={auth_mode === "login" ? login_form.password : signup_form.password}
                onChange={(e) => auth_mode === "login"
                  ? set_login_form({ ...login_form, password: e.target.value })
                  : set_signup_form({ ...signup_form, password: e.target.value })
                }
                required
              />
            </div>

            <button className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-md hover:opacity-90 transition-all shadow-lg active:scale-95" type="submit">
              {auth_mode === "login" ? "Sign In" : "Submit Request"}
            </button>
          </form>

          <div className="border-t pt-8 flex flex-col gap-4 text-center">
            <button 
              className="text-sm font-bold text-primary hover:underline transition-opacity hover:opacity-80"
              onClick={() => {
                set_auth_mode(auth_mode === "login" ? "signup" : "login")
                set_error_message("")
                set_signup_status("")
              }}
            >
              {auth_mode === "login" ? "Request account access" : "Back to sign in"}
            </button>
            {auth_mode === "login" && (
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none pointer-events-none opacity-50">
                Authorized personnel only
              </span>
            )}
          </div>
        </div>
      </div>
    )

  }

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/10">
      <aside className="w-72 min-w-[18rem] bg-card border-r flex flex-col p-8 hidden md:flex h-screen sticky top-0">
        <div className="px-2 mb-10">
          <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">Billing Dashboard</h1>
        </div>
        
        <nav className="flex flex-col gap-1.5 flex-1">
          {visible_nav_items.map((item) => {
            const IconComponent = item.icon
            const isActive = active_view === item.id
            return (
              <button
                key={item.id}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                type="button"
                onClick={() => set_active_view(item.id)}
              >
                {IconComponent && <IconComponent size={18} className={cn("transition-transform group-hover:scale-110", isActive ? "opacity-100" : "opacity-70")} />}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t pt-8 mt-auto flex flex-col gap-6">
          <div className="px-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Session Role</p>
            <p className="text-sm font-bold truncate">{role}</p>
          </div>
          <button
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-bold text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
            type="button"
            onClick={() => {
              set_auth_token(null)
              set_is_authenticated(false)
              set_current_user(null)
              set_role("viewer")
              set_login_form({ username_or_email: "", password: "" })
              set_signup_status("")
              set_error_message("")
            }}
          >
            <Play className="rotate-180" size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-x-hidden">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tighter capitalize leading-none">
              {nav_items.find(item => item.id === active_view)?.label || active_view}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 font-medium">B2B Automated Billing Governance</p>
          </div>
          <div className="flex gap-3">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-bold h-10 px-6 border bg-background hover:bg-accent transition-colors" type="button" onClick={reload_all}>
              Refresh
            </button>
            <button className="inline-flex items-center justify-center rounded-md text-sm font-bold h-10 px-6 bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md" type="button" onClick={() => set_active_view("cycles")}>
              New Cycle
            </button>
          </div>
        </header>


        {error_message ? <div className="alert error">{error_message}</div> : null}
        {toast ? (
          <div className="toast-stack" key={toast.id}>
            <div className={`toast-item ${toast.tone}`}>
              {toast.message}
            </div>
          </div>
        ) : null}
        {role === "billing" && approval_notifications.length > 0 ? (
          <div className="alert info">
            {approval_notifications.map((approval) => (
              <div key={approval.id}>
                Approval granted for {format_stage_label(approval.stage)} on cycle {format_cycle_label(approval.billing_cycle_id)}.
              </div>
            ))}
          </div>
        ) : null}

        {active_view === "user-guide" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>User Guide</h2>
                <p>Step-by-step instructions for your role.</p>
              </div>
              <button className="secondary-button" type="button" onClick={handle_user_guide_pdf}>
                Download PDF
              </button>
            </div>
            <div className="doc-content markdown" ref={user_guide_ref}>
              <ReactMarkdown>{role === "finance" ? financeUserGuideDoc : billingUserGuideDoc}</ReactMarkdown>
            </div>
          </section>
        )}

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

            <CycleProgressTracker 
              cycle={cycles.length > 0 ? cycles[0] : null} 
              scripts={scripts}
              runs={runs}
              approvals={approvals}
            />





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
                    <div key={approval.id} style={{ display: "flex", flexDirection: "column" }}>
                      <div 
                        className="table-row" 
                        style={{ cursor: "pointer" }}
                        onClick={() => set_expanded_approval_id(expanded_approval_id === approval.id ? null : approval.id)}
                      >
                        <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                        <span>{format_stage_label(approval.stage)}</span>
                        <span className={`pill ${approval.status === "pending" ? "warning" : approval.status === "rejected" ? "error" : "success"}`}>
                          {approval.status}
                        </span>
                        {role === "finance" ? (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
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
                      {expanded_approval_id === approval.id && (
                        <div style={{ margin: "0 16px 16px 16px", padding: "16px", backgroundColor: "rgba(0, 0, 0, 0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <strong>Details & Comments:</strong>
                          <p style={{ marginTop: "8px", color: "var(--text-primary)" }}>{approval.comments || "No comments provided."}</p>
                        </div>
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
                  <span className="pill neutral">{format_cycle_status(cycle.status)}</span>
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
              <div className="parameter-grid">
                {Object.keys(parameter_overrides).map((key) => (
                  <label key={key} className={use_default_params ? "is-read-only" : ""}>
                    {key.toUpperCase()}
                    <input
                      value={parameter_overrides[key]}
                      onChange={(event) =>
                        !use_default_params && set_parameter_overrides((previous) => ({
                          ...previous,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder={key.toUpperCase()}
                      readOnly={use_default_params}
                      required={script_form.script_type === "printing" && key === "p6"}
                    />
                  </label>
                ))}
              </div>

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
              {!script_form.billing_cycle_id ? (
                <div className="empty-state">Select a billing cycle to view generated scripts.</div>
              ) : (
                filtered_scripts.map((script) => {
                  const cycle = cycles_by_id.get(String(script.billing_cycle_id))
                  const cycle_label = cycle
                    ? `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
                    : script.billing_cycle_id.slice(0, 8)
                  return (
                    <div className="table-row" key={script.id}>
                      <div className="stacked-cell">
                        <span>{cycle_label}</span>
                        <div className="command-shell">
                          <div className="command-meta">
                            <span className="pill neutral">{script.environment}</span>
                            <span className="pill neutral">{script.script_type}</span>
                            <span className="pill neutral">{script.log_type}</span>
                          </div>
                          <pre className="command-output mono">{script.command_text}</pre>
                        </div>
                      </div>
                      <span>{script.environment}</span>
                      <span>{script.log_type}</span>
                      <span>{new Date(script.created_at).toLocaleString()}</span>
                    </div>
                  )
                })
              )}
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
                  <option value="">Select cycle...</option>
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
            </div>

            <CycleProgressTracker
              cycle={cycles.find((c) => String(c.id) === run_cycle_id)}
              scripts={scripts}
              runs={runs}
              approvals={approvals}
            />

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
                <div className="full">
                  <p className="helper">Request details</p>
                <div className="summary-card">
                  <div>
                    <span className="label">Cycle</span>
                    <span>{format_cycle_label(approval_request_form.billing_cycle_id)}</span>
                  </div>
                  <div>
                    <span className="label">Stage</span>
                    <span>{format_stage_label(approval_request_form.stage)}</span>
                  </div>
                  <div>
                    <span className="label">Requested by</span>
                    <span>{current_user?.name || "-"}</span>
                  </div>
                </div>
              </div>
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
                <div className="full">
                  <p className="helper">Finance recipients</p>
                  {finance_recipients.length === 0 ? (
                    <div className="empty-state">Add finance recipients in Request Settings.</div>
                  ) : (
                    <div className="checkbox-grid recipients-grid">
                      {finance_recipients.map((email) => (
                        <label key={email} className="checkbox-pill recipient-pill">
                          <input
                            type="checkbox"
                            checked={selected_finance_recipients.includes(email)}
                            onChange={() => toggle_finance_recipient(email)}
                          />
                          <a href={`mailto:${email}`} onClick={(event) => event.stopPropagation()}>{email}</a>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <label className="full">
                  Message to finance
                  <textarea
                    value={approval_request_form.comments}
                    onChange={(event) =>
                      set_approval_request_form((previous) => ({
                        ...previous,
                        comments: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    !approval_request_form.billing_cycle_id || approval_recipients_missing || approval_request_pending
                  }
                >
                  {approval_request_pending ? "Sending request..." : "Request approval"}
                </button>
                {approval_request_feedback ? (
                  <div className="alert info full">{approval_request_feedback}</div>
                ) : null}
                {recipient_error ? <div className="alert warning full">{recipient_error}</div> : null}
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
                      <div key={approval.id} style={{ display: "flex", flexDirection: "column" }}>
                        <div 
                          className="table-row" 
                          style={{ cursor: "pointer" }}
                          onClick={() => set_expanded_approval_id(expanded_approval_id === approval.id ? null : approval.id)}
                        >
                          <span>{format_cycle_label(approval.billing_cycle_id)}</span>
                          <span>{format_stage_label(approval.stage)}</span>
                          <span>{new Date(approval.updated_at).toLocaleString()}</span>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              set_approval_form((previous) => ({
                                ...previous,
                                billing_cycle_id: String(approval.billing_cycle_id),
                                stage: approval.stage,
                                status: "approved",
                              }))
                            }}
                          >
                            Review
                          </button>
                        </div>
                        {expanded_approval_id === approval.id && (
                          <div style={{ margin: "0 16px 16px 16px", padding: "16px", backgroundColor: "rgba(0, 0, 0, 0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <strong>Details & Comments:</strong>
                            <p style={{ marginTop: "8px", color: "var(--text-primary)" }}>{approval.comments || "No comments provided."}</p>
                          </div>
                        )}
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
                        <div key={approval.id} style={{ display: "flex", flexDirection: "column" }}>
                          <div 
                            className="table-row" 
                            style={{ cursor: "pointer" }}
                            onClick={() => set_expanded_approval_id(expanded_approval_id === approval.id ? null : approval.id)}
                          >
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
                          {expanded_approval_id === approval.id && (
                            <div style={{ margin: "0 16px 16px 16px", padding: "16px", backgroundColor: "rgba(0, 0, 0, 0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                              <strong>Details & Comments:</strong>
                              <p style={{ marginTop: "8px", color: "var(--text-primary)" }}>{approval.comments || "No comments provided."}</p>
                            </div>
                          )}
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
                  <div key={approval.id} style={{ display: "flex", flexDirection: "column" }}>
                    <div 
                      className="table-row" 
                      style={{ cursor: "pointer" }}
                      onClick={() => set_expanded_approval_id(expanded_approval_id === approval.id ? null : approval.id)}
                    >
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
                    {expanded_approval_id === approval.id && (
                      <div style={{ margin: "0 16px 16px 16px", padding: "16px", backgroundColor: "rgba(0, 0, 0, 0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <strong>Details & Comments:</strong>
                        <p style={{ marginTop: "8px", color: "var(--text-primary)" }}>{approval.comments || "No comments provided."}</p>
                      </div>
                    )}
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
                <p>Generate the backend command after post-live approval.</p>
              </div>
            </div>
            <div className="notification-guide">
              <div className="notification-block">
                <h4>Email notifications</h4>
                <p>
                  Run the email notification script for the selected date. This triggers the standard
                  Streamserve email notification flow for real billing.
                </p>
                <p className="helper">Email notifications command</p>
                <pre className="command-block mono">/cer_cerprod/Dominique/EMAIL_NOTIFICATION_FOR_REAL_BILL_FINAL.sh</pre>
              </div>
              <div className="notification-block">
                <h4>SMS notifications</h4>
                <p>
                  Run the SMS notification script for the selected date. This sends SMS notifications for
                  the completed real billing cycle.
                </p>
                <p className="helper">SMS notifications command</p>
                <pre className="command-block mono">/cer_cerprod/Dominique/SMS_NOTIFICATION_FOR_REAL_BILL.sh</pre>
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
                Notification date
                <input
                  type="date"
                  value={notification_form.notification_date}
                  onChange={(event) =>
                    set_notification_form((previous) => ({
                      ...previous,
                      notification_date: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  !notification_form.billing_cycle_id ||
                  !notification_form.notification_date ||
                  notification_blocked
                }
              >
                Generate command
              </button>
            </form>
            {last_notification_command ? (
              <div className="notification-download">
                <div>
                  <p className="helper">Latest generated commands</p>
                  <pre className="command-block mono">{last_notification_command.message}</pre>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    const cycle_label = format_cycle_label(last_notification_command.billing_cycle_id)
                    const date_label = last_notification_command.notification_date
                    const filename = `notifications_${cycle_label.replace(/\s+/g, "_")}_${date_label}.txt`
                    const content = [
                      "Billing Notifications Commands",
                      "================================",
                      `Billing cycle: ${cycle_label}`,
                      `Notification date: ${date_label}`,
                      "",
                      last_notification_command.message,
                    ].join("\n")
                    download_text_file(filename, content)
                  }}
                >
                  Download commands
                </button>
              </div>
            ) : null}
            {notification_form.billing_cycle_id && notification_blocked ? (
              <div className="alert warning">
                Post-live approval is required before generating the command.
              </div>
            ) : null}
            <div className="table">
              <div className="table-row table-head">
                <span>Cycle</span>
                <span>Command</span>
                <span>Status</span>
                <span>Created</span>
              </div>
              {notifications.map((notification) => (
                <div className="table-row" key={notification.id}>
                  <span>{format_cycle_label(notification.billing_cycle_id)}</span>
                  <span>
                    <pre className="command-block mono">{notification.message}</pre>
                  </span>
                  <span className={`pill ${notification.status === "ready" ? "success" : "warning"}`}>
                    {notification.status}
                  </span>
                  <span>
                    {notification.created_at ? new Date(notification.created_at).toLocaleString() : "-"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {active_view === "request-settings" && role !== "finance" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Request Settings</h2>
                <p>Configure approval request defaults for finance notifications.</p>
              </div>
            </div>
            <form className="form-grid" autoComplete="off">
              <div className="full">
                <p className="helper">Finance recipients</p>
                <div className="recipient-row">
                  <input
                    value={finance_recipient_input}
                    onChange={(event) => set_finance_recipient_input(event.target.value)}
                    placeholder="finance@example.com"
                    name="finance-recipient"
                    autoComplete="off"
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handle_add_finance_recipient}
                  >
                    Add
                  </button>
                </div>
                {finance_recipients.length === 0 ? (
                  <div className="empty-state">Add at least one finance email.</div>
                ) : (
                  <div className="checkbox-grid recipients-grid">
                    {finance_recipients.map((email) => (
                      <label key={email} className="checkbox-pill recipient-pill">
                        <input
                          type="checkbox"
                          checked={selected_finance_recipients.includes(email)}
                          onChange={() => toggle_finance_recipient(email)}
                        />
                        <a href={`mailto:${email}`} onClick={(event) => event.stopPropagation()}>{email}</a>
                        <button
                          className="text-button"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            remove_finance_recipient(email)
                          }}
                        >
                          Remove
                        </button>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label>
                Requester name
                <input
                  value={request_settings.requester_name}
                  disabled
                  placeholder="Name used in approval requests"
                  required
                />
              </label>
              <label>
                Billing department email
                <input
                  value={request_settings.billing_email}
                  placeholder="information-system@cwseychelles.com"
                  name="billing-email"
                  autoComplete="email"
                  disabled
                  required
                />
              </label>
              <label className="full">
                Default message
                <textarea
                  value={request_settings.default_message}
                  onChange={(event) =>
                    set_request_settings((previous) => ({
                      ...previous,
                      default_message: event.target.value,
                    }))
                  }
                  placeholder="Add a default message for approval requests"
                />
              </label>
              {request_settings_status ? (
                <div className="alert info full">{request_settings_status}</div>
              ) : null}
            </form>
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
                <span>Result</span>
                <span>Timestamp</span>
              </div>
{audit_logs.map((entry) => {
                const metadata = safe_parse_metadata(entry.metadata_json || entry.metadata)
                const result = format_audit_result(entry, metadata)
                const action_label = format_audit_action_label(entry.action, entry.actor_type)
                const actor_name = metadata.actor_name || entry.actor_name || metadata.username || "-"
                const details = metadata.message || metadata.note || metadata.reason || metadata.error || "-"
                const non_trivial_metadata = Object.entries(metadata).filter(([, value]) => value !== null && value !== "").filter(([key]) => !["status", "decision"].includes(String(key)))
                return (
                <div className="table-row" key={entry.id}>
                  <span className="stacked-cell audit-action">
                    <span>{action_label}</span>
                  </span>
                  <span>{entry.entity_type || metadata.entity_type || "-"}</span>
                  <span>{actor_name}</span>
                  <span className={result !== "-" ? `pill ${result === "approved" || result === "success" || result === "executed" ? "success" : result === "rejected" || result === "failed" ? "warning" : "neutral"}` : ""}>
                    {result}
                  </span>
                  <span className="stacked-cell">
                    <span>{entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</span>
                    {details !== "-" ? <span className="mono muted">note: {details}</span> : null}
                  </span>
                </div>
              )})}
            </div>
          </section>
        )}

        {active_view === "documentation" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Documentation</h2>
                <p>Select a guide to view in the workspace.</p>
              </div>
              <select
                className="select-inline"
                value={active_documentation_id}
                onChange={(event) => set_active_documentation_id(event.target.value)}
              >
                {documentation_sets.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="doc-actions">
              {documentation_sets.find((doc) => doc.id === active_documentation_id)?.pdf ? (
                <a
                  className="secondary-button"
                  href={documentation_sets.find((doc) => doc.id === active_documentation_id)?.pdf}
                  target="_blank"
                  rel="noreferrer"
                >
                  View original PDF
                </a>
              ) : null}
            </div>
            <div className="doc-content markdown">
              <ReactMarkdown>
                {documentation_sets.find((doc) => doc.id === active_documentation_id)?.content || ""}
              </ReactMarkdown>
            </div>
          </section>
        )}

        {active_view === "admin" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Admin Controls</h2>
                <p>Review access requests and manage users.</p>
              </div>
            </div>
            <div className="panel-subheader">
              <h3>Signup requests</h3>
              <p>Approve or reject pending access requests.</p>
            </div>
            <div className="table">
              <div className="table-row table-head admin">
                <span>Name</span>
                <span>Username</span>
                <span>Email</span>
                <span>Status</span>
                <span>Role</span>
                <span>Action</span>
              </div>
              {pending_signup_requests.length === 0 ? (
                <div className="empty-state">No signup requests pending.</div>
              ) : (
                pending_signup_requests.map((request) => (
                  <div className="table-row admin" key={request.id}>
                    <span>{request.name}</span>
                    <span>{request.username}</span>
                    <span>{request.email}</span>
                    <span className={`pill ${request.status === "pending" ? "warning" : "neutral"}`}>
                      {request.status}
                    </span>
                    <select
                      className="select-inline"
                      value={signup_role_selection[request.id] || request.assigned_role || "billing"}
                      onChange={(event) =>
                        set_signup_role_selection((previous) => ({
                          ...previous,
                          [request.id]: event.target.value,
                        }))
                      }
                      disabled={request.status !== "pending"}
                    >
                      <option value="billing">Billing</option>
                      <option value="finance">Finance</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <div className="form-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => handle_signup_approve(request.id)}
                        disabled={request.status !== "pending"}
                      >
                        Approve
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handle_signup_reject(request.id)}
                        disabled={request.status !== "pending"}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <details className="panel-details">
              <summary>Processed requests ({handled_signup_requests.length})</summary>
              <div className="table">
                <div className="table-row table-head admin">
                  <span>Name</span>
                  <span>Username</span>
                  <span>Email</span>
                  <span>Status</span>
                  <span>Role</span>
                  <span>Action</span>
                </div>
                {handled_signup_requests.length === 0 ? (
                  <div className="empty-state">No processed signup requests.</div>
                ) : (
                  handled_signup_requests.map((request) => (
                    <div className="table-row admin" key={request.id}>
                      <span>{request.name}</span>
                      <span>{request.username}</span>
                      <span>{request.email}</span>
                      <span className={`pill ${request.status === "approved" ? "success" : "neutral"}`}>
                        {request.status}
                      </span>
                      <span>{request.assigned_role || "-"}</span>
                      <span className="muted">-</span>
                    </div>
                  ))
                )}
              </div>
            </details>

            <div className="section-divider" />

            <div className="panel-subheader">
              <h3>Create user</h3>
              <p>Add a user directly without approval.</p>
            </div>
            <form className="form-grid" onSubmit={handle_admin_user_create}>
              <label>
                Full name
                <input
                  value={admin_user_form.name}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Username
                <input
                  value={admin_user_form.username}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
                      ...previous,
                      username: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={admin_user_form.email}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Role
                <select
                  value={admin_user_form.role}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
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
              <label>
                Password
                <input
                  type="password"
                  value={admin_user_form.password}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Status
                <select
                  value={admin_user_form.is_active ? "active" : "inactive"}
                  onChange={(event) =>
                    set_admin_user_form((previous) => ({
                      ...previous,
                      is_active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <button className="primary-button" type="submit">
                Create user
              </button>
            </form>

            <div className="section-divider" />

            <div className="panel-subheader">
              <h3>Manage users</h3>
              <p>Edit user details, roles, and status.</p>
            </div>
            <div className="table">
              <div className="table-row table-head admin">
                <span>Name</span>
                <span>Username</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {users.map((user) => (
                <div className="table-row admin" key={user.id}>
                  <span>{user.name}</span>
                  <span>{user.username}</span>
                  <span>{user.email}</span>
                  <span>{user.role}</span>
                  <span className={`pill ${user.is_active ? "success" : "warning"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        set_admin_edit_user(user)
                        set_admin_edit_form({
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
                      className="ghost-button"
                      type="button"
                      onClick={() => handle_admin_user_delete(user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {admin_edit_user ? (
              <form className="form-grid" onSubmit={handle_admin_user_update}>
                <label>
                  Full name
                  <input
                    value={admin_edit_form.name}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={admin_edit_form.username}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={admin_edit_form.email}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Role
                  <select
                    value={admin_edit_form.role}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
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
                <label>
                  Status
                  <select
                    value={admin_edit_form.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
                        ...previous,
                        is_active: event.target.value === "active",
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label>
                  Reset password
                  <input
                    type="password"
                    value={admin_edit_form.password}
                    onChange={(event) =>
                      set_admin_edit_form((previous) => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    Save changes
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      set_admin_edit_user(null)
                      set_admin_edit_form({
                        name: "",
                        username: "",
                        email: "",
                        role: "billing",
                        password: "",
                        is_active: true,
                      })
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
