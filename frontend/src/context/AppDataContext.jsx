/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { api_fetch } from "../api"

const AppDataContext = createContext(null)

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider")
  }
  return context
}

export const show_toast = (message, tone = "info") => {
  if (tone === "success") {
    toast.success(message)
  } else if (tone === "error") {
    toast.error(message)
  } else {
    toast.info(message)
  }
}

export function AppDataProvider({ current_user, role, on_sign_out, children }) {
  const [cycles, set_cycles] = useState([])
  const [scripts, set_scripts] = useState([])
  const [runs, set_runs] = useState([])
  const [approvals, set_approvals] = useState([])
  const [notifications, set_notifications] = useState([])
  const [audit_logs, set_audit_logs] = useState([])
  const [users, set_users] = useState([])
  const [error_message, set_error_message] = useState("")
  const [initial_loading, set_initial_loading] = useState(true)
  const [approval_notifications, set_approval_notifications] = useState([])

  const [request_settings, set_request_settings] = useState({
    billing_email: "information-system@cwseychelles.com",
    default_message: "",
  })
  const [finance_recipients, set_finance_recipients] = useState([])
  const [request_settings_status, set_request_settings_status] = useState("")
  const request_settings_loaded = useRef(false)

  const is_operator = role === "billing_user" || role === "system_admin"

  const reload_all = useCallback(async () => {
    try {
      set_error_message("")
      const [cycles_data, scripts_data, runs_data, approvals_data, notifications_data, audit_data] = await Promise.all([
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

      if (role === "system_admin") {
        set_users(await api_fetch("/users/"))
      } else {
        set_users([])
      }
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_initial_loading(false)
    }
  }, [role])

  useEffect(() => {
    reload_all()
    const interval = setInterval(reload_all, 30000)
    return () => clearInterval(interval)
  }, [reload_all])

  useEffect(() => {
    if (!is_operator) {
      return
    }
    const load_settings = async () => {
      try {
        const settings = await api_fetch("/approvals/settings")
        set_request_settings({
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
  }, [is_operator])

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
      } catch {
        set_request_settings_status("Failed to save settings.")
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [request_settings, finance_recipients])

  useEffect(() => {
    if (role !== "billing_user" || approvals.length === 0) {
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

  const cycles_by_id = useMemo(() => new Map(cycles.map((cycle) => [String(cycle.id), cycle])), [cycles])
  const scripts_by_id = useMemo(() => new Map(scripts.map((script) => [String(script.id), script])), [scripts])
  const runs_by_script_id = useMemo(() => new Map(runs.map((run) => [String(run.script_definition_id), run])), [runs])
  const pending_approvals = useMemo(() => approvals.filter((approval) => approval.status === "pending"), [approvals])
  const approvals_by_cycle_stage = useMemo(() => {
    const map = new Map()
    approvals.forEach((approval) => {
      map.set(`${approval.billing_cycle_id}:${approval.stage}`, approval)
    })
    return map
  }, [approvals])

  const value = {
    current_user,
    role,
    is_operator,
    on_sign_out,
    cycles,
    scripts,
    runs,
    approvals,
    notifications,
    audit_logs,
    users,
    error_message,
    set_error_message,
    initial_loading,
    reload_all,
    approval_notifications,
    request_settings,
    set_request_settings,
    finance_recipients,
    set_finance_recipients,
    request_settings_status,
    cycles_by_id,
    scripts_by_id,
    runs_by_script_id,
    pending_approvals,
    approvals_by_cycle_stage,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
