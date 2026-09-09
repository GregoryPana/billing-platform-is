import { useEffect, useState } from "react"

/* Single source of truth for theme resolution/application, shared by the
   inline pre-paint bootstrap in index.html (which must stay a standalone
   script — it has to run synchronously before any module loads, so it
   mirrors this exact algorithm rather than importing it) and every React
   consumer (Sidebar, ThemeReviewPage). Do not fork this logic elsewhere. */

export const THEME_KEY = "billing_theme"

export function resolve_initial_theme() {
  if (typeof window === "undefined") {
    return "light"
  }
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === "light" || stored === "dark") {
      return stored
    }
  } catch {
    // Storage may be unavailable in a locked-down browser; system preference still applies.
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function apply_theme(theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState(resolve_initial_theme)

  useEffect(() => {
    apply_theme(theme)
  }, [theme])

  const set_theme_preference = (next_theme) => {
    setTheme((current_theme) => {
      const resolved_theme = typeof next_theme === "function" ? next_theme(current_theme) : next_theme
      try {
        window.localStorage.setItem(THEME_KEY, resolved_theme)
      } catch {
        // The in-memory preference still works when storage is unavailable.
      }
      return resolved_theme
    })
  }

  return [theme, set_theme_preference]
}
