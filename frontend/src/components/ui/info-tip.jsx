import { useId } from "react"

/* Hover- and focus-accessible "i" info-tip. Markup matches DESIGN_SYSTEM.md §9.2 exactly;
   the Escape handler is an addition so keyboard users can dismiss without tabbing away. */
export function InfoTip({ label, children }) {
  const tip_id = useId()

  const handle_key_down = (event) => {
    if (event.key === "Escape") {
      event.currentTarget.blur()
    }
  }

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tip_id}
        onKeyDown={handle_key_down}
        className="flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border bg-muted text-[11px] font-bold text-muted-foreground"
      >
        i
      </button>
      <span
        id={tip_id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-[min(280px,78vw)] rounded-md border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}
