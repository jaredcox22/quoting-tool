import { jsPDF } from "jspdf/dist/jspdf.es.min.js"
import { autoTable } from "jspdf-autotable"
import type { QuoteExportPayload } from "@/lib/quote-export"

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)
}

function formatCompactNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  const s = n.toPrecision(4)
  return parseFloat(s).toString()
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function exportQuoteToPdf(payload: QuoteExportPayload): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 48

  doc.setFontSize(18)
  doc.text("Standing Seam Estimate", pageW / 2, y, { align: "center" })
  y += 28

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  const generated = formatGeneratedAt(payload.generatedAt)
  doc.text(`Roof type: ${payload.roofTypeName}`, 48, y)
  y += 16
  doc.text(`Generated: ${generated}`, 48, y)
  y += 24

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: payload.measurements.map((m) => [m.label, m.value]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4, halign: "left" },
    headStyles: { fillColor: [66, 66, 66], halign: "left" },
    columnStyles: {
      0: { cellWidth: 220, halign: "left" },
      1: { cellWidth: "auto", halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.halign = "right"
      }
    },
  })

  const docWithTable = doc as jsPDF & { lastAutoTable: { finalY: number } }
  y = docWithTable.lastAutoTable.finalY + 20

  const feeRows: (string | number)[][] = [
    ["Material subtotal", formatCurrency(payload.totals.materialSubtotal)],
    ["Sub labor", formatCurrency(payload.totals.subLabor)],
    [
      `Dumpster fee`,
      formatCurrency(payload.totals.dumpsterFee),
    ],
    ["Satellite", formatCurrency(payload.totals.satellite)],
    ["Permits", formatCurrency(payload.totals.permits)],
    [
      `Sales tax (${formatCompactNumber(payload.feePercentages.salesTaxPct)}%)`,
      formatCurrency(payload.totals.salesTax),
    ],
    [
      `Financing (${formatCompactNumber(payload.feePercentages.financingPct)}%)`,
      formatCurrency(payload.totals.financing),
    ],
    ["Total fees & adjustments (incl. financing)", formatCurrency(payload.totals.totalFeesAndAdjustments)],
    [
      `Commission (${formatCompactNumber(payload.feePercentages.commissionPct)}%)`,
      formatCurrency(payload.totals.commission),
    ],
    [
      "Goal profit margin (target)",
      `${formatCompactNumber(payload.feePercentages.goalProfitMarginPct)}%`,
    ],
    ["Expected profit", formatCurrency(payload.totals.profit)],
    ["Sale price", formatCurrency(payload.totals.salePrice)],
  ]

  if (payload.totals.invalidMarginTarget) {
    feeRows.push(["Note", "Sale price invalid: margin + commission + financing must be below 100%."])
  }

  autoTable(doc, {
    startY: y,
    head: [["Line item", "Amount"]],
    body: feeRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4, halign: "left" },
    headStyles: { fillColor: [66, 66, 66], halign: "left" },
    columnStyles: {
      0: { cellWidth: 280, halign: "left" },
      1: { cellWidth: "auto", halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.halign = "right"
      }
    },
  })

  y = docWithTable.lastAutoTable.finalY + 16
  doc.setFontSize(8)
  doc.setTextColor(100)
  const disclaimer =
    "Pricing and fees reflect the calculator at export time. Final quote may vary based on site conditions."
  const split = doc.splitTextToSize(disclaimer, pageW - 96)
  doc.text(split, 48, y)

  const safeId = payload.roofTypeId.replace(/[^a-z0-9-]+/gi, "-")
  const d = new Date(payload.generatedAt)
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  doc.save(`roof-quote-${safeId}-${dateStr}.pdf`)
}
