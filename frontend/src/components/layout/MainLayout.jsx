import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { RefreshCcw } from "lucide-react"

import { Button } from "../ui/button"
import { Skeleton } from "../ui/skeleton"
import { useAppData } from "../../context/AppDataContext"
import { cycle_month_pair, format_stage_label } from "../../lib/format"
import { Sidebar } from "./Sidebar"
import { nav_items_for_role } from "./nav"

export function MainLayout() {
  const {
    role,
    on_sign_out,
    error_message,
    reload_all,
    initial_loading,
    approval_notifications,
    cycles_by_id,
  } = useAppData()
  const location = useLocation()
  const navigate = useNavigate()

  const nav_items = nav_items_for_role(role)
  const active_item =
    nav_items.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) || nav_items[0]

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Sidebar />

      <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 rounded-md border bg-card p-4 md:hidden">
          <div className="mb-3">
            <p className="text-sm font-medium text-foreground">Navigation</p>
            <p className="text-xs text-muted-foreground">Switch sections on smaller screens.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={active_item?.path || "/overview"}
              onChange={(event) => navigate(event.target.value)}
            >
              {nav_items.map((item) => (
                <option key={item.path} value={item.path}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              type="button"
              onClick={on_sign_out}
            >
              Sign Out
            </button>
          </div>
        </div>

        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-none tracking-tight md:text-3xl">{active_item?.label}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{active_item?.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={reload_all}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </header>

        {error_message ? <div className="alert error">{error_message}</div> : null}
        {role === "billing_user" && approval_notifications.length > 0 ? (
          <div className="alert info">
            {approval_notifications.map((approval) => {
              const cycle = cycles_by_id.get(String(approval.billing_cycle_id))
              return (
                <div key={approval.id}>
                  Approval granted for {format_stage_label(approval.stage)} on cycle {cycle_month_pair(cycle)}.
                </div>
              )
            })}
          </div>
        ) : null}

        {initial_loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-[106px]" />
              <Skeleton className="h-[106px]" />
              <Skeleton className="h-[106px]" />
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
