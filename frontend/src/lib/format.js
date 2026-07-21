export const cycle_types = [
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

export const format_month_label = (value) => {
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

export const format_cycle_datetime = (value) => {
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

export const format_input_date = (value = new Date()) => {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, "0")
  const dd = String(value.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export const download_text_file = (filename, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const format_cycle_status = (status) => {
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

export const format_stage_label = (stage) => {
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

export const cycle_month_pair = (cycle) => {
  if (!cycle) {
    return "-"
  }
  return `${format_month_label(cycle.usage_month)} - ${format_month_label(cycle.billing_month)}`
}

export const build_default_parameters = (script_type, environment, cycle_month) => {
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

export const safe_parse_metadata = (value) => {
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

export const format_audit_result = (entry, metadata) => {
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

export const format_audit_action_label = (action, actor_type) => {
  if (!action) {
    return "-"
  }
  const actor_desc =
    actor_type === "billing" ? "by Billing" : actor_type === "finance" ? "by Finance" : actor_type === "admin" ? "by Admin" : ""

  const friendly = {
    "create cycle": `Created billing cycle ${actor_desc}`,
    "generate script": `Generated scripts ${actor_desc}`,
    "execute run": `Marked run executed ${actor_desc}`,
    "mark run executed": `Marked run executed ${actor_desc}`,
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
  return String(action).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export const normalize_email = (value) => value.trim().toLowerCase()
export const is_valid_email = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)

/* Shared workflow progression model — used by the progress tracker, the
   overview cycle list, and the workspace stage gating. */
export const compute_cycle_steps = (cycle, scripts = [], runs = [], approvals = []) => {
  if (!cycle) {
    return null
  }
  const scripts_by_id = new Map(scripts.map((s) => [String(s.id), s]))
  const cycle_id = String(cycle.id)
  const cycle_scripts = scripts.filter((s) => String(s.billing_cycle_id) === cycle_id)

  const has_script = (env, type) => cycle_scripts.some((s) => s.environment === env && s.script_type === type)
  const has_executed = (env) =>
    runs.some((r) => {
      const s = scripts_by_id.get(String(r.script_definition_id))
      return s && String(s.billing_cycle_id) === cycle_id && s.environment === env && r.status === "executed"
    })

  const get_approval = (stage) => approvals.find((a) => String(a.billing_cycle_id) === cycle_id && a.stage === stage)

  const steps = [
    { label: "Created", done: true },
    { label: "Test Scripts", done: has_script("test", "preparation") || has_script("test", "printing") },
    { label: "Test Runs", done: has_executed("test") },
    { label: "Approval (Test)", done: get_approval("test")?.status === "approved", rejected: get_approval("test")?.status === "rejected" },
    { label: "Live Scripts", done: has_script("live", "preparation") || has_script("live", "printing") },
    { label: "Live Runs", done: has_executed("live") },
    {
      label: "Approval (Live)",
      done: get_approval("live")?.status === "approved" || get_approval("post_live")?.status === "approved",
      rejected: get_approval("live")?.status === "rejected",
    },
    { label: "Closed", done: cycle.status === "closed" },
  ]

  const completed_steps = steps.filter((step) => step.done).length
  const progress = Math.round((completed_steps / steps.length) * 100)
  const has_rejection = steps.some((step) => step.rejected)

  return {
    steps,
    progress,
    completed_steps,
    has_rejection,
    test_approval: get_approval("test"),
    post_live_approval: get_approval("post_live"),
  }
}

/* Stage readiness: all preparation + printing scripts for the environment
   exist and every one of them has an executed run. */
export const compute_stage_ready = (cycle_id, environment, scripts, runs_by_script_id) => {
  if (!cycle_id) {
    return false
  }
  const stage_scripts = scripts.filter(
    (script) => String(script.billing_cycle_id) === String(cycle_id) && script.environment === environment
  )
  if (stage_scripts.length === 0) {
    return false
  }
  const has_required = ["preparation", "printing"].every((script_type) =>
    stage_scripts.some((script) => script.script_type === script_type)
  )
  if (!has_required) {
    return false
  }
  return stage_scripts.every((script) => {
    const run = runs_by_script_id.get(String(script.id))
    return run?.status === "executed"
  })
}
