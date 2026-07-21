import { BookOpen, CheckCircle, LayoutDashboard, RefreshCcw, Shield } from "lucide-react"

/* Navigation grouped by user intent: operate (Overview, Cycles), decide
   (Approvals Inbox), administer (Administration), help. Roles gate entries. */
export const nav_config = [
  {
    path: "/overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Track in-flight cycles, recent runs, and pending approvals at a glance.",
    roles: ["billing_user", "finance_user", "system_admin"],
  },
  {
    path: "/cycles",
    label: "Billing Cycles",
    icon: RefreshCcw,
    description: "Create cycles and walk each one through scripts, runs, approvals, and notifications.",
    roles: ["billing_user", "system_admin"],
  },
  {
    path: "/approvals",
    label: "Approvals Inbox",
    icon: CheckCircle,
    description: "Review pending approval requests and record decisions.",
    roles: ["finance_user", "system_admin"],
  },
  {
    path: "/administration",
    label: "Administration",
    icon: Shield,
    description: "Settings, user accounts, access requests, and the audit log.",
    roles: ["billing_user", "system_admin"],
  },
  {
    path: "/help",
    label: "Help",
    icon: BookOpen,
    description: "User guide and reference documentation for the billing process.",
    roles: ["billing_user", "finance_user", "system_admin"],
  },
]

export const nav_items_for_role = (role) => nav_config.filter((item) => item.roles.includes(role))
