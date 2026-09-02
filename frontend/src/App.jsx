import { lazy, Suspense, useEffect, useState } from "react"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { api_fetch, get_auth_token, set_auth_token } from "./api"
import {
  acquire_entra_token,
  auth_mode_config_error,
  complete_entra_redirect,
  entra_config_error,
  is_entra_auth_mode,
  sign_in_with_entra,
  sign_out_from_entra,
} from "./entra"
import { Button } from "./components/ui/button"
import { AppDataProvider } from "./context/AppDataContext"
import { MainLayout } from "./components/layout/MainLayout"
import { LoginPage } from "./features/auth/LoginPage"
import { OverviewPage } from "./features/overview/OverviewPage"
import { CyclesListPage } from "./features/cycles/CyclesListPage"
import { CycleWorkspacePage } from "./features/cycles/CycleWorkspacePage"
import { ApprovalsInboxPage } from "./features/approvals/ApprovalsInboxPage"
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary"
import "./App.css"

const BillingIssueReportingPage = lazy(() =>
  import("./features/reporting/BillingIssueReportingPage").then((m) => ({ default: m.BillingIssueReportingPage }))
)
const AdministrationPage = lazy(() =>
  import("./features/admin/AdministrationPage").then((m) => ({ default: m.AdministrationPage }))
)
const HelpPage = lazy(() => import("./features/help/HelpPage").then((m) => ({ default: m.HelpPage })))

function RouteLoading() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center p-8" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

function RequireRole({ role, allowed, children }) {
  if (!allowed.includes(role)) {
    return <Navigate to="/overview" replace />
  }
  return children
}

// Guards against a redirect loop: set right before the first automatic
// loginRedirect() this session, cleared on a successful sign-in. If we come
// back from Microsoft and still have no usable session with the guard
// already set, we stop and show a retry surface instead of redirecting
// again indefinitely.
const ENTRA_REDIRECT_GUARD_KEY = "billing_entra_redirect_guard"

function EntraSignInError({ message, allow_retry, on_retry }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-lg border border-transparent bg-card p-8 text-center shadow-sm dark:border-border">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Platform</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Coordinates the monthly billing cycle and prepares commands and approvals — billing execution stays in
            Cerillion.
          </p>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {message}
        </div>
        {allow_retry ? (
          <Button onClick={on_retry}>Try Microsoft Sign-In Again</Button>
        ) : (
          <p className="text-xs text-muted-foreground">Contact an administrator to resolve this configuration issue.</p>
        )}
      </div>
    </div>
  )
}

function App() {
  const [current_user, set_current_user] = useState(null)
  const [auth_bootstrap_pending, set_auth_bootstrap_pending] = useState(true)
  const [entra_auth_error, set_entra_auth_error] = useState(null)

  const clear_session = () => {
    set_auth_token(null)
    set_current_user(null)
  }

  const handle_sign_out = async () => {
    clear_session()
    if (is_entra_auth_mode) {
      try {
        await sign_out_from_entra()
      } catch {
        // Keep local session cleared even if IdP logout fails.
      }
    }
  }

  const retry_entra_sign_in = async () => {
    set_entra_auth_error(null)
    try {
      sessionStorage.setItem(ENTRA_REDIRECT_GUARD_KEY, "true")
      await sign_in_with_entra()
    } catch (error) {
      set_entra_auth_error(error?.message || "Microsoft sign-in failed.")
    }
  }

  useEffect(() => {
    const bootstrap_local_auth = async () => {
      try {
        const token = get_auth_token()
        if (token) {
          const me = await api_fetch("/auth/me")
          set_current_user(me)
        }
      } catch {
        clear_session()
      } finally {
        set_auth_bootstrap_pending(false)
      }
    }

    const bootstrap_entra_auth = async () => {
      if (entra_config_error) {
        set_entra_auth_error(entra_config_error)
        set_auth_bootstrap_pending(false)
        return
      }
      try {
        const account = await complete_entra_redirect()
        const entra_token = account ? await acquire_entra_token() : null
        if (entra_token) {
          sessionStorage.removeItem(ENTRA_REDIRECT_GUARD_KEY)
          set_auth_token(entra_token)
          const me = await api_fetch("/auth/me")
          set_current_user(me)
          set_auth_bootstrap_pending(false)
          return
        }

        if (sessionStorage.getItem(ENTRA_REDIRECT_GUARD_KEY) === "true") {
          set_entra_auth_error("Microsoft sign-in did not complete. Please try again.")
          set_auth_bootstrap_pending(false)
          return
        }

        // No active session yet: redirect to Microsoft immediately, before
        // ever rendering a local login form.
        sessionStorage.setItem(ENTRA_REDIRECT_GUARD_KEY, "true")
        await sign_in_with_entra()
        // loginRedirect() navigates away; stay pending until it does.
      } catch (error) {
        clear_session()
        set_entra_auth_error(error?.message || "Microsoft sign-in failed.")
        set_auth_bootstrap_pending(false)
      }
    }

    if (auth_mode_config_error) {
      set_entra_auth_error(auth_mode_config_error)
      set_auth_bootstrap_pending(false)
    } else if (is_entra_auth_mode) {
      bootstrap_entra_auth()
    } else {
      bootstrap_local_auth()
    }
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
    if (is_entra_auth_mode || auth_mode_config_error) {
      return (
        <EntraSignInError
          message={entra_auth_error || "Microsoft sign-in is required."}
          allow_retry={!entra_config_error}
          on_retry={retry_entra_sign_in}
        />
      )
    }
    return <LoginPage on_authenticated={set_current_user} />
  }

  const role = current_user.role || ""

  return (
    <AppDataProvider current_user={current_user} role={role} on_sign_out={handle_sign_out}>
      <HashRouter>
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoading />}>
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
                  path="/reporting"
                  element={
                    <RequireRole role={role} allowed={["finance_user", "system_admin"]}>
                      <BillingIssueReportingPage />
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
          </Suspense>
        </RouteErrorBoundary>
      </HashRouter>
    </AppDataProvider>
  )
}

export default App
