import { useEffect, useRef } from "react"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"

/* Lightweight modal (no portal/Radix), matching confirm-dialog.jsx's
   approach. Controlled via `open`; Escape and overlay click both close. */
export function Dialog({ open, onOpenChange, title, description, className, children }) {
  const panel_ref = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    panel_ref.current?.focus()
    const handle_key = (event) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", handle_key)
    return () => window.removeEventListener("keydown", handle_key)
  }, [open, onOpenChange])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 py-10"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={panel_ref}
        tabIndex={-1}
        className={cn(
          "w-full max-w-lg rounded-lg border border-transparent bg-card p-6 shadow-lg dark:border-border",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            type="button"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
