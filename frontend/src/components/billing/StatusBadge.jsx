import { Badge } from "../ui/badge"

const status_variants = {
  approved: "success",
  executed: "success",
  success: "success",
  active: "success",
  ready: "success",
  sent: "success",
  pending: "warning",
  planned: "warning",
  inactive: "warning",
  rejected: "destructive",
  failed: "destructive",
  completed: "success",
  "test run phase": "default",
  "live run phase": "default",
  "notification phase": "default",
}

export function StatusBadge({ status, className }) {
  if (!status || status === "-") {
    return <span className="text-muted-foreground">-</span>
  }
  const variant = status_variants[String(status).toLowerCase()] || "neutral"
  return (
    <Badge variant={variant} className={className ? `capitalize ${className}` : "capitalize"}>
      {String(status).replace(/_/g, " ")}
    </Badge>
  )
}
