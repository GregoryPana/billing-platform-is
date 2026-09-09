import { forwardRef } from "react"

import { cn } from "../../lib/utils"

const DataTable = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-hidden rounded-md border border-border bg-card", className)} {...props} />
))
DataTable.displayName = "DataTable"

const rowVariantClasses = {
  default: "grid-cols-[1.5fr_1fr_1fr_1fr] max-[900px]:grid-cols-[1.2fr_1fr_1fr_1fr]",
  runs: "gap-x-3 grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr] max-[900px]:grid-cols-[1.2fr_1fr_1fr_1fr]",
  admin: "grid-cols-[1fr_1fr_1.4fr_0.9fr_1fr_1.2fr] max-[900px]:grid-cols-[1fr_1fr_1.2fr]",
}

const DataTableRow = forwardRef(({ className, variant = "default", head = false, as, ...props }, ref) => {
  const Tag = as || "div"
  return (
    <Tag
      ref={ref}
      className={cn(
        "grid items-center gap-x-4 border-b border-border px-4 py-4 text-sm transition-colors last:border-b-0",
        "max-[900px]:gap-x-[10px] max-[900px]:px-[10px] max-[900px]:text-[13px]",
        rowVariantClasses[variant],
        head
          ? "bg-muted/50 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          : "hover:bg-muted/50",
        className
      )}
      {...props}
    />
  )
})
DataTableRow.displayName = "DataTableRow"

export { DataTable, DataTableRow }
