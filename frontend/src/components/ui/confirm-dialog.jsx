import { useEffect, useRef } from "react"

import { Button } from "./button"

/* Lightweight confirmation dialog (no portal/Radix). Controlled via `open`.
   Used for destructive confirmations per DESIGN_SYSTEM.md §7.3. */
export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", onConfirm, onCancel }) {
  const confirm_ref = useRef(null)

  useEffect(() => {
    if (open) {
      confirm_ref.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const handle_key = (event) => {
      if (event.key === "Escape") {
        onCancel()
      }
    }
    window.addEventListener("keydown", handle_key)
    return () => window.removeEventListener("keydown", handle_key)
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-transparent bg-card p-6 shadow-lg dark:border-border"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button ref={confirm_ref} variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
