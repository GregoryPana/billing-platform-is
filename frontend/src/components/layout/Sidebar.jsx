import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { LogOut, Moon, Sun } from "lucide-react"

import { cn } from "../../lib/utils"
import { useAppData } from "../../context/AppDataContext"
import { nav_items_for_role } from "./nav"

const THEME_KEY = "billing_theme"

export function Sidebar() {
  const { current_user, role, on_sign_out } = useAppData()
  const [theme, set_theme] = useState(() => localStorage.getItem(THEME_KEY) || "light")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <aside className="hidden h-screen w-64 min-w-[16rem] flex-col self-start border-r bg-card p-6 md:sticky md:top-0 md:flex">
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing Platform</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        {nav_items_for_role(role).map((item) => {
          const IconComponent = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-border bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              {IconComponent && <IconComponent className="h-4 w-4" aria-hidden="true" />}
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4 border-t pt-6">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{current_user?.name || "-"}</p>
            <p className="truncate text-xs text-muted-foreground">{current_user?.email || role}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => set_theme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <button
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          type="button"
          onClick={on_sign_out}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
