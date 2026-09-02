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

/* Pages declare the collections they read via `useDataScope`. AppDataProvider
   ref-counts active subscriptions and only fetches/polls what at least one
   mounted consumer currently needs, instead of every collection on every tick.
   Pass a stable (module-level or memoized) array — it is used as an effect dep. */
export function useDataScope(collections) {
  const { register_scope } = useAppData()
  useEffect(() => {
    return register_scope(collections)
  }, [register_scope, collections])
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

const COLLECTION_ENDPOINTS = {
  cycles: "/cycles/",
  scripts: "/scripts/",
  runs: "/runs/",
  approvals: "/approvals/",
  notifications: "/notifications/",
  audit_logs: "/audit/",
  users: "/users/",
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

  const setters = useMemo(
    () => ({
      cycles: set_cycles,
      scripts: set_scripts,
      runs: set_runs,
      approvals: set_approvals,
      notifications: set_notifications,
      audit_logs: set_audit_logs,
      users: set_users,
    }),
    []
  )

  const scope_counts = useRef({
    cycles: 0,
    scripts: 0,
    runs: 0,
    approvals: 0,
    notifications: 0,
    audit_logs: 0,
    users: 0,
  })
  const mounted_once = useRef(false)

  const fetch_collection = useCallback(
    async (key) => {
      if (key === "users" && role !== "system_admin") {
        return
      }
      setters[key](await api_fetch(COLLECTION_ENDPOINTS[key]))
    },
    [role, setters]
  )

  const reload_active = useCallback(async () => {
    try {
      set_error_message("")
      const active_keys = Object.keys(scope_counts.current).filter((key) => scope_counts.current[key] > 0)
      await Promise.all(active_keys.map(fetch_collection))
    } catch (error) {
      set_error_message(error.message)
    } finally {
      set_initial_loading(false)
    }
  }, [fetch_collection])

  /* Ref-counted subscription: a collection is fetched/polled only while at
     least one mounted consumer has registered it. Registrations that happen
     during the initial mount are picked up by the provider's own mount effect
     below (it runs last, after every descendant's mount effect); registrations
     from later route navigation fetch their newly-needed collections immediately
     instead of waiting for the next poll tick. */
  const register_scope = useCallback(
    (collections) => {
      const newly_added = []
      collections.forEach((key) => {
        scope_counts.current[key] = (scope_counts.current[key] || 0) + 1
        if (scope_counts.current[key] === 1) {
          newly_added.push(key)
        }
      })
      if (mounted_once.current && newly_added.length > 0) {
        Promise.all(newly_added.map(fetch_collection)).catch((error) => set_error_message(error.message))
      }
      return () => {
        collections.forEach((key) => {
          scope_counts.current[key] = Math.max(0, (scope_counts.current[key] || 0) - 1)
        })
      }
    },
    [fetch_collection]
  )

  const reload_all = reload_active

  useEffect(() => {
    mounted_once.current = true
    reload_active()
    const interval = setInterval(reload_active, 30000)
    return () => clearInterval(interval)
  }, [reload_active])

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
    register_scope,
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
