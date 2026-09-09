import { Loader2, Moon, Sun } from "../../lib/icons"

import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Select } from "../../components/ui/select"
import { Textarea } from "../../components/ui/textarea"
import { Skeleton } from "../../components/ui/skeleton"
import { EmptyState } from "../../components/ui/empty-state"
import { DataTable, DataTableRow } from "../../components/ui/data-table"
import { Panel, PanelHeader, PanelTitle, PanelDescription, PanelSubheader, PanelSubheaderTitle } from "../../components/ui/panel"
import { useTheme } from "../../lib/theme"

/* Internal-only theme foundation review surface (RG-01 UX-1). Renders every
   semantic token against real shared primitives so light/dark, contrast, and
   focus states can be checked in one place. Route is registered only under
   import.meta.env.DEV in App.jsx — it never ships in a production build and
   is not linked from any nav. See docs/rg01-handoffs/ux-1-semantic-themes-evidence.md. */

const NEUTRAL_TOKENS = [
  { name: "--background", swatch: "bg-background", label: "Page background" },
  { name: "--foreground", swatch: "bg-foreground", label: "Primary text" },
  { name: "--card", swatch: "bg-card border", label: "Card surface" },
  { name: "--card-foreground", swatch: "bg-card-foreground", label: "Card text" },
  { name: "--muted", swatch: "bg-muted", label: "Muted surface" },
  { name: "--muted-foreground", swatch: "bg-muted-foreground", label: "Muted text" },
  { name: "--border / --input", swatch: "bg-border", label: "Borders & inputs" },
  { name: "--popover", swatch: "bg-popover border", label: "Popover surface" },
]

const BRAND_TOKENS = [
  { name: "--primary", swatch: "bg-primary", label: "Brand blue" },
  { name: "--secondary", swatch: "bg-secondary", label: "Secondary (tinted neutral)" },
  { name: "--accent", swatch: "bg-accent", label: "Hover / interactive surface" },
]

const SEMANTIC_TOKENS = [
  { name: "--success", swatch: "bg-success", label: "Success" },
  { name: "--warning", swatch: "bg-warning", label: "Warning" },
  { name: "--destructive", swatch: "bg-destructive", label: "Danger / destructive" },
  { name: "--info", swatch: "bg-info", label: "Info" },
]

function TokenSwatch({ token }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-muted p-3">
      <div className={`h-10 w-10 shrink-0 rounded-md border border-border ${token.swatch}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{token.label}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{token.name}</p>
      </div>
    </div>
  )
}

export function ThemeReviewPage() {
  const [theme, set_theme] = useTheme()

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1200px] bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mb-6 rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-soft-foreground">
        Internal development-only theme review surface (RG-01 UX-1). Not linked from app navigation; excluded from
        production builds via <code className="mono">import.meta.env.DEV</code>. Do not use for real billing data.
      </div>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Theme Foundation Review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Typography, components, and semantic tokens in both themes for UX-1 verification.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => set_theme((current) => (current === "dark" ? "light" : "dark"))}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </Button>
      </header>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Color tokens</PanelTitle>
            <PanelDescription>Named semantic CSS variables consumed through Tailwind. Current mode: {theme}.</PanelDescription>
          </div>
        </PanelHeader>

        <PanelSubheader className="mt-0">
          <PanelSubheaderTitle>Neutral surfaces &amp; text</PanelSubheaderTitle>
        </PanelSubheader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {NEUTRAL_TOKENS.map((token) => (
            <TokenSwatch key={token.name} token={token} />
          ))}
        </div>

        <PanelSubheader>
          <PanelSubheaderTitle>Brand</PanelSubheaderTitle>
        </PanelSubheader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BRAND_TOKENS.map((token) => (
            <TokenSwatch key={token.name} token={token} />
          ))}
        </div>

        <PanelSubheader>
          <PanelSubheaderTitle>Semantic (success / warning / danger / info)</PanelSubheaderTitle>
        </PanelSubheader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {SEMANTIC_TOKENS.map((token) => (
            <TokenSwatch key={token.name} token={token} />
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Typography</PanelTitle>
            <PanelDescription>Fixed scale — page title through caption.</PanelDescription>
          </div>
        </PanelHeader>
        <div className="space-y-3">
          <p className="text-2xl font-semibold tracking-tight md:text-3xl">Page title (h1)</p>
          <p className="text-xl font-semibold tracking-tight">Section title (h2)</p>
          <p className="text-base font-medium">Card title (h3)</p>
          <p className="text-sm">Body text (text-sm) — the default size for app UI content and descriptions.</p>
          <p className="text-xs text-muted-foreground">Caption / meta (text-xs text-muted-foreground)</p>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Label (eyebrow)</p>
          <p className="text-3xl font-semibold tabular-nums">1,234.56</p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Buttons</PanelTitle>
            <PanelDescription>All variants and sizes. Tab through to verify the focus ring.</PanelDescription>
          </div>
        </PanelHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="default">Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline" className="ring-2 ring-ring ring-offset-2 ring-offset-background">
            Focus-visible specimen
          </Button>
          <Button variant="default" disabled>
            Disabled
          </Button>
          <Button variant="default" disabled>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default size</Button>
          <Button size="icon" aria-label="Icon button example">
            <Sun className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Badges</PanelTitle>
            <PanelDescription>Status vocabulary reused across the app.</PanelDescription>
          </div>
        </PanelHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Draft</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="default">Submitted</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="destructive">Rejected</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Pills</PanelTitle>
            <PanelDescription>Legacy bridge-class equivalent of badges (App.css .pill).</PanelDescription>
          </div>
        </PanelHeader>
        <div className="flex flex-wrap gap-2">
          <span className="pill neutral">Draft</span>
          <span className="pill warning">Pending</span>
          <span className="pill success">Approved</span>
          <span className="pill danger">Rejected</span>
          <span className="pill info">Info</span>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Alert states</PanelTitle>
            <PanelDescription>Persistent inline banners (toast events are separate — sonner).</PanelDescription>
          </div>
        </PanelHeader>
        <div className="space-y-3">
          <div className="alert info">Info: this cycle has notifications ready to review.</div>
          <div className="alert success">Success: the billing run completed without errors.</div>
          <div className="alert warning">Warning: two approvals are still pending finance review.</div>
          <div className="alert error">Error: could not save your changes. Please try again.</div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Form controls</PanelTitle>
            <PanelDescription>Inputs, select, textarea, and disabled/focus states.</PanelDescription>
          </div>
        </PanelHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="review-input">Text input</Label>
            <Input id="review-input" placeholder="Placeholder text" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-select">Select</Label>
            <Select id="review-select" defaultValue="">
              <option value="" disabled>
                Choose an option
              </option>
              <option value="one">Option one</option>
              <option value="two">Option two</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-disabled">Disabled input</Label>
            <Input id="review-disabled" defaultValue="Read-only value" disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="review-textarea">Textarea</Label>
            <Textarea id="review-textarea" placeholder="Multi-line text" rows={3} />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Table</PanelTitle>
            <PanelDescription>Header row, hover state, and empty state.</PanelDescription>
          </div>
        </PanelHeader>
        <DataTable>
          <DataTableRow head>
            <span>Cycle</span>
            <span>Status</span>
            <span>Updated</span>
            <span>Owner</span>
          </DataTableRow>
          <DataTableRow>
            <span>2026-09</span>
            <span>
              <Badge variant="success">Approved</Badge>
            </span>
            <span>Today</span>
            <span>Finance</span>
          </DataTableRow>
          <DataTableRow>
            <span>2026-08</span>
            <span>
              <Badge variant="warning">Pending</Badge>
            </span>
            <span>Yesterday</span>
            <span>Billing</span>
          </DataTableRow>
        </DataTable>
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Empty state</p>
          <DataTable>
            <DataTableRow head>
              <span>Cycle</span>
              <span>Status</span>
            </DataTableRow>
            <EmptyState>No rows to display. This is the shared empty-state pattern.</EmptyState>
          </DataTable>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Loading skeletons</PanelTitle>
            <PanelDescription>Shaped placeholders shown while content loads.</PanelDescription>
          </div>
        </PanelHeader>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[106px]" />
          <Skeleton className="h-[106px]" />
          <Skeleton className="h-[106px]" />
        </div>
      </Panel>
    </div>
  )
}
