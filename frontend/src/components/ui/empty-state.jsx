import { forwardRef } from "react"

import { cn } from "../../lib/utils"

const EmptyState = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 py-16 text-center text-sm text-muted-foreground", className)} {...props} />
))
EmptyState.displayName = "EmptyState"

export { EmptyState }
