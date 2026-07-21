import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import html2pdf from "html2pdf.js"

import { useAppData } from "../../context/AppDataContext"
import { cn } from "../../lib/utils"
import { format_input_date } from "../../lib/format"

import billingProcessDoc from "../../../../docs/platform/billing_process.md?raw"
import billingUserGuideDoc from "../../../../docs/platform/billing_user_guide.md?raw"
import financeUserGuideDoc from "../../../../docs/platform/finance_user_guide.md?raw"
import billingProcessPdf from "../../../../docs/platform/Billing Process.pdf"

/* User Guide + reference documentation combined into one Help destination. */
export function HelpPage() {
  const { role } = useAppData()
  const guide_ref = useRef(null)

  const docs = useMemo(
    () => [
      {
        id: "user-guide",
        label: "User Guide",
        description: "Step-by-step instructions for your role.",
        content: role === "finance_user" ? financeUserGuideDoc : billingUserGuideDoc,
        pdf_export: true,
      },
      {
        id: "billing-process",
        label: "Billing Process",
        description: "The end-to-end billing process reference document.",
        content: billingProcessDoc,
        pdf: billingProcessPdf,
      },
    ],
    [role]
  )

  const [active_id, set_active_id] = useState("user-guide")
  const active_doc = docs.find((doc) => doc.id === active_id)

  const handle_pdf_export = async () => {
    if (!guide_ref.current) {
      return
    }
    const filename = `billing_user_guide_${format_input_date()}.pdf`
    document.body.classList.add("pdf-export")
    try {
      await html2pdf()
        .set({
          margin: [10, 10, 12, 10],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(guide_ref.current)
        .save()
    } finally {
      document.body.classList.remove("pdf-export")
    }
  }

  return (
    <section className="panel doc-panel">
      <div className="panel-header">
        <div>
          <h2>{active_doc?.label}</h2>
          <p>{active_doc?.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Help documents">
            {docs.map((doc) => (
              <button
                key={doc.id}
                role="tab"
                aria-selected={active_id === doc.id}
                type="button"
                className={cn(
                  "inline-flex h-9 items-center rounded-md border border-transparent px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active_id === doc.id
                    ? "bg-background text-foreground shadow-sm dark:border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => set_active_id(doc.id)}
              >
                {doc.label}
              </button>
            ))}
          </div>
          {active_doc?.pdf_export ? (
            <button className="secondary-button" type="button" onClick={handle_pdf_export}>
              Download PDF
            </button>
          ) : null}
          {active_doc?.pdf ? (
            <a className="secondary-button" href={active_doc.pdf} target="_blank" rel="noreferrer">
              View Original PDF
            </a>
          ) : null}
        </div>
      </div>
      <div className="doc-content markdown" ref={active_id === "user-guide" ? guide_ref : null}>
        <ReactMarkdown>{active_doc?.content || ""}</ReactMarkdown>
      </div>
    </section>
  )
}
