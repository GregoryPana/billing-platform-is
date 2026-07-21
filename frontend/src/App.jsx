import { useEffect, useState } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { api_fetch, get_auth_token, set_auth_token } from "./api"
import { bootstrap_entra_token, entra_enabled, sign_out_from_entra } from "./entra"
import { AppDataProvider } from "./context/AppDataContext"
import { MainLayout } from "./components/layout/MainLayout"
import { LoginPage } from "./features/auth/LoginPage"
import { OverviewPage } from "./features/overview/OverviewPage"
import { CyclesListPage } from "./features/cycles/CyclesListPage"
import { CycleWorkspacePage } from "./features/cycles/CycleWorkspacePage"
import { ApprovalsInboxPage } from "./features/approvals/ApprovalsInboxPage"
import { AdministrationPage } from "./features/admin/AdministrationPage"
import { HelpPage } from "./features/help/HelpPage"
import "./App.css"

function RequireRole({ role, allowed, children }) {
  if (!allowed.includes(role)) {
    return <Navigate to="/overview" replace />
  }
  return children
}

function App() {
  const [current_user, set_current_user] = useState(null)
  const [auth_bootstrap_pending, set_auth_bootstrap_pending] = useState(true)

  const clear_session = () => {
    set_auth_token(null)
    set_current_user(null)
  }

  const handle_sign_out = async () => {
    const auth_source = current_user?.auth_source
    clear_session()
    if (auth_source === "entra_id") {
      try {
        await sign_out_from_entra()
      } catch {
        // Keep local session cleared even if IdP logout fails.
      }
    }
  }

  useEffect(() => {
    const bootstrap_auth = async () => {
      try {
        const token = get_auth_token()
        if (token) {
          const me = await api_fetch("/auth/me")
          set_current_user(me)
          return
        }
        if (entra_enabled) {
          const entra_token = await bootstrap_entra_token()
          if (entra_token) {
            set_auth_token(entra_token)
            const me = await api_fetch("/auth/me")
            set_current_user(me)
          }
        }
      } catch {
        clear_session()
      } finally {
        set_auth_bootstrap_pending(false)
      }
    }
    bootstrap_auth()
  }, [])

  if (auth_bootstrap_pending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-[440px] flex-col items-center gap-4 rounded-lg border border-transparent bg-card p-8 text-center shadow-sm dark:border-border">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Platform</h1>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Checking your access…</p>
        </div>
      </div>
    )
  }

  if (!current_user) {
    return <LoginPage on_authenticated={set_current_user} />
  }

  const role = current_user.role || ""

  return (
    <AppDataProvider current_user={current_user} role={role} on_sign_out={handle_sign_out}>
      <HashRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/overview" element={<OverviewPage />} />
            <Route
              path="/cycles"
              element={
                <RequireRole role={role} allowed={["billing_user", "finance_user", "system_admin"]}>
                  <CyclesListPage />
                </RequireRole>
              }
            />
            <Route
              path="/cycles/:cycle_id"
              element={
                <RequireRole role={role} allowed={["billing_user", "finance_user", "system_admin"]}>
                  <CycleWorkspacePage />
                </RequireRole>
              }
            />
            <Route
              path="/approvals"
              element={
                <RequireRole role={role} allowed={["finance_user", "system_admin"]}>
                  <ApprovalsInboxPage />
                </RequireRole>
              }
            />
            <Route
              path="/approvals/:approval_id"
              element={
                <RequireRole role={role} allowed={["finance_user", "system_admin"]}>
                  <ApprovalsInboxPage />
                </RequireRole>
              }
            />
            <Route
              path="/administration"
              element={
                <RequireRole role={role} allowed={["billing_user", "system_admin"]}>
                  <AdministrationPage />
                </RequireRole>
              }
            />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppDataProvider>
  )
}

export default App
