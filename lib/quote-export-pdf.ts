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

function lastAutoTableFinalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/** Match header + body row metrics across all PDF tables (compact, identical sizing) */
const SHARED_TABLE_STYLES = {
  theme: "striped" as const,
  styles: {
    fontSize: 7.5,
    cellPadding: 2,
    halign: "left" as const,
    valign: "middle" as const,
    overflow: "linebreak" as const,
  },
  headStyles: {
    fillColor: [66, 66, 66] as [number, number, number],
    halign: "left" as const,
    valign: "middle" as const,
    fontSize: 7.5,
    cellPadding: 2,
  },
}

export function exportQuoteToPdf(payload: QuoteExportPayload): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const gutter = 10
  const leftColW = 246
  /** Distance from page right edge — table width = pageW - margin - leftMargin */
  const leftTableRightMargin = pageW - margin - leftColW
  const rightTableLeft = margin + leftColW + gutter

  let y = margin

  doc.setFontSize(16)
  doc.text("Standing Seam Estimate", pageW / 2, y, { align: "center" })
  y += 22
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Roof type: ${payload.roofTypeName}`, margin, y)
  y += 14
  doc.text(`Generated: ${formatGeneratedAt(payload.generatedAt)}`, margin, y)
  y += 18

  const yTables = y

  autoTable(doc, {
    startY: yTables,
    margin: { left: margin, right: leftTableRightMargin },
    head: [["Project Measurements", "Value"]],
    body: payload.measurements.map((m) => [m.label, m.value]),
    ...SHARED_TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 138, halign: "left" },
      1: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.halign = "right"
      }
    },
  })

  const yAfterMeasurements = lastAutoTableFinalY(doc)

  const feeRows: (string | number)[][] = [
    ["Material subtotal", formatCurrency(payload.totals.materialSubtotal)],
    ["Sub labor", formatCurrency(payload.totals.subLabor)],
    ["Dumpster fee", formatCurrency(payload.totals.dumpsterFee)],
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
    ["Goal profit margin (target)", `${formatCompactNumber(payload.feePercentages.goalProfitMarginPct)}%`],
    ["Expected profit", formatCurrency(payload.totals.profit)],
    ["Sale price", formatCurrency(payload.totals.salePrice)],
  ]

  if (payload.totals.invalidMarginTarget) {
    feeRows.push(["Note", "Sale price invalid: margin + commission + financing must be below 100%."])
  }

  autoTable(doc, {
    startY: yAfterMeasurements + 12,
    margin: { left: margin, right: leftTableRightMargin },
    head: [["Line item", "Amount"]],
    body: feeRows,
    ...SHARED_TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 142, halign: "left" },
      1: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.halign = "right"
      }
    },
  })

  const yLeftBottom = lastAutoTableFinalY(doc)

  const materialBody = normalizeMaterialBodyForAutoTable(payload.materialListBody)

  autoTable(doc, {
    startY: yTables,
    margin: { left: rightTableLeft, right: margin },
    head: [["Material List", "Unit", "Qty", "Amt"]],
    body: materialBody,
    ...SHARED_TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 118, halign: "left" },
      1: { cellWidth: 46, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
      3: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 1) {
        data.cell.styles.halign = data.column.index === 1 || data.column.index === 2 || data.column.index === 3 ? "right" : "left"
      }
      if (data.section === "body" && data.column.index >= 1) {
        data.cell.styles.halign = "right"
      }
    },
  })

  const yRightBottom = lastAutoTableFinalY(doc)
  let yFooter = Math.max(yLeftBottom, yRightBottom) + 12

  const disclaimer =
    "Pricing and fees reflect the calculator at export time. Final quote may vary based on site conditions."
  doc.setFontSize(7)
  doc.setTextColor(100)
  const split = doc.splitTextToSize(disclaimer, pageW - margin * 2)
  const disclaimerH = split.length * 8.5
  if (yFooter + disclaimerH > pageH - margin) {
    yFooter = pageH - margin - disclaimerH
  }
  doc.text(split, margin, yFooter)

  const safeId = payload.roofTypeId.replace(/[^a-z0-9-]+/gi, "-")
  const d = new Date(payload.generatedAt)
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  doc.save(`roof-quote-${safeId}-${dateStr}.pdf`)
}

/** Coerce QuoteMaterialListCell rows into autoTable's expected body format */
function normalizeMaterialBodyForAutoTable(
  rows: QuoteMaterialListCell[][],
): (string | Record<string, unknown>)[][] {
  return rows.map((row) =>
    row.map((cell) => {
      if (typeof cell === "string") return cell
      return {
        content: cell.content,
        colSpan: cell.colSpan,
        styles: cell.styles,
      }
    }),
  )
}
