import { forwardRef } from "react"

import { cn } from "../../lib/utils"

const Panel = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mb-6 rounded-lg border border-transparent bg-card p-6 text-card-foreground shadow-sm dark:border-border max-[900px]:p-4",
      className
    )}
    {...props}
  />
))
Panel.displayName = "Panel"

const PanelHeader = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="panel-header"
    className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}
    {...props}
  />
))
PanelHeader.displayName = "PanelHeader"

const PanelTitle = forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-xl font-semibold tracking-tight text-foreground", className)} {...props} />
))
PanelTitle.displayName = "PanelTitle"

const PanelDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />
))
PanelDescription.displayName = "PanelDescription"

const PanelSubheader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-4 mt-8", className)} {...props} />
))
PanelSubheader.displayName = "PanelSubheader"

const PanelSubheaderTitle = forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-base font-medium text-foreground", className)} {...props} />
))
PanelSubheaderTitle.displayName = "PanelSubheaderTitle"

const PanelSubheaderDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("mt-1 text-xs text-muted-foreground", className)} {...props} />
))
PanelSubheaderDescription.displayName = "PanelSubheaderDescription"

const PanelDetails = forwardRef(({ className, ...props }, ref) => (
  <details ref={ref} className={cn("mt-4", className)} {...props} />
))
PanelDetails.displayName = "PanelDetails"

const PanelDetailsSummary = forwardRef(({ className, ...props }, ref) => (
  <summary ref={ref} className={cn("mb-3 cursor-pointer text-sm font-medium text-foreground", className)} {...props} />
))
PanelDetailsSummary.displayName = "PanelDetailsSummary"

export {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelDescription,
  PanelSubheader,
  PanelSubheaderTitle,
  PanelSubheaderDescription,
  PanelDetails,
  PanelDetailsSummary,
}
