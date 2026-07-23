import { forwardRef } from "react"

import { cn } from "../../lib/utils"

/* Native select styled to match Input. Swap for the Radix-based shadcn Select
   if richer behavior (search, groups) is ever needed. */
const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = "Select"

export { Select }
