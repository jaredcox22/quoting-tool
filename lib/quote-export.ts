import type { FeeConfig, LineItemDetail, PricingBreakdown, PricingData } from "@/lib/google-sheets"

/** Mirrors calculator form fields for JSON / LP reuse */
export interface QuoteFormSnapshot {
  squares: number
  steepPitchSquares: number
  layers: number
  cedarShakeLayers: number
  ridgeLength: number
  hipLength: number
  eaveLength: number
  rakeLength: number
  valleyLength: number
  wallFlashing: number
  stepFlashing: number
  pitchChange: number
  pipeFlashingUpTo6: number
  pipeFlashingUpTo13: number
  pipeFlashingUpTo19: number
  ventilation: number
  snowRetention: number
}

export interface QuoteCalculationsSnapshot {
  squaresQty: number
  steepPitchSquaresQty: number
  steepPitchAdder: number
  ridgeQty: number
  hipQty: number
  eaveQty: number
  rakeQty: number
  valleysQty: number
  wallFlashingQty: number
  stepFlashingQty: number
  pitchChangeQty: number
  pipeFlashingQty: number
  pipeFlashingQtyUpTo6: number
  pipeFlashingQtyUpTo13: number
  pipeFlashingQtyUpTo19: number
  ventilationQty: number
  snowRetentionQty: number
  miscFixedCostQty: number
  squares: number
  ridge: number
  hip: number
  eave: number
  rake: number
  valleys: number
  wallFlashing: number
  stepFlashing: number
  pitchChange: number
  pipeFlashing: number
  ventilation: number
  snowRetention: number
  miscFixedCost: number
  dumpsterSquaresForTier: number
  weightedLayers: number
  materialSubtotal: number
  subLabor: number
  subLaborPanels: number
  subLaborRidge: number
  dumpsterFee: number
  financing: number
  salesTax: number
  totalHardCosts: number
  commission: number
  profit: number
  salePrice: number
  invalidMarginTarget: boolean
}

/** Rows for autoTable: strings or cell objects with colSpan */
export type QuoteMaterialListCell = string | { content: string; colSpan?: number; styles?: { fontStyle?: string } }

export interface QuoteExportPayload {
  generatedAt: string
  roofTypeId: string
  roofTypeName: string
  hasCedarShake: boolean
  measurements: { label: string; value: string }[]
  /** Right column: detailed material lines (mirrors in-app Materials breakdown) */
  materialListBody: QuoteMaterialListCell[][]
  feePercentages: {
    commissionPct: number
    financingPct: number
    salesTaxPct: number
    goalProfitMarginPct: number
  }
  totals: {
    materialSubtotal: number
    subLabor: number
    dumpsterFee: number
    satellite: number
    permits: number
    salesTax: number
    financing: number
    totalFeesAndAdjustments: number
    commission: number
    profit: number
    salePrice: number
    invalidMarginTarget: boolean
  }
}

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

const MATERIAL_RATE_ROWS: readonly {
  rateKey: keyof PricingData
  label: string
  calcKey: keyof QuoteCalculationsSnapshot
  quantityKey: keyof QuoteCalculationsSnapshot
}[] = [
  { rateKey: "squareRate", label: "Squares", calcKey: "squares", quantityKey: "squaresQty" },
  { rateKey: "ridgeRate", label: "Ridge", calcKey: "ridge", quantityKey: "ridgeQty" },
  { rateKey: "hipRate", label: "Hip", calcKey: "hip", quantityKey: "hipQty" },
  { rateKey: "eaveRate", label: "Eaves", calcKey: "eave", quantityKey: "eaveQty" },
  { rateKey: "rakeRate", label: "Rakes", calcKey: "rake", quantityKey: "rakeQty" },
  { rateKey: "valleyRate", label: "Valleys", calcKey: "valleys", quantityKey: "valleysQty" },
  { rateKey: "wallFlashingRate", label: "Wall Flashing", calcKey: "wallFlashing", quantityKey: "wallFlashingQty" },
  { rateKey: "stepFlashingRate", label: "Step Flashing", calcKey: "stepFlashing", quantityKey: "stepFlashingQty" },
  { rateKey: "pitchChangeRate", label: "Pitch Changes", calcKey: "pitchChange", quantityKey: "pitchChangeQty" },
  { rateKey: "pipeFlashingRate", label: "Pipe Flashing", calcKey: "pipeFlashing", quantityKey: "pipeFlashingQty" },
  { rateKey: "ventilationRate", label: "Ventilation", calcKey: "ventilation", quantityKey: "ventilationQty" },
  { rateKey: "snowRetentionRate", label: "Snow Retention", calcKey: "snowRetention", quantityKey: "snowRetentionQty" },
  { rateKey: "miscFixedCost", label: "Misc Materials", calcKey: "miscFixedCost", quantityKey: "miscFixedCostQty" },
]

function buildDetailLines(
  rateKey: string,
  items: LineItemDetail[] | undefined,
  quantity: number,
  c: QuoteCalculationsSnapshot,
): { name: string; unit: number; qty: number; total: number }[] {
  const detailRows = (items ?? []).map((item) => {
    const name = item.name.toLowerCase()
    const customPipeQty =
      rateKey === "pipeFlashingRate"
        ? name.includes("up to 19")
          ? c.pipeFlashingQtyUpTo19
          : name.includes("up to 13")
            ? c.pipeFlashingQtyUpTo13
            : name.includes("up to 6")
              ? c.pipeFlashingQtyUpTo6
              : 0
        : null
    const miscEffectiveQty =
      rateKey === "miscFixedCost"
        ? item.miscUnit === "perSq"
          ? c.squaresQty
          : 1
        : null
    const rawUnits =
      customPipeQty != null
        ? customPipeQty
        : miscEffectiveQty != null
          ? item.multiplier * miscEffectiveQty
          : item.multiplier * quantity
    const billableUnits =
      customPipeQty != null ? customPipeQty : item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits
    const total = item.costPerUnit * billableUnits
    return { name: item.name, unit: item.costPerUnit, qty: billableUnits, total }
  })

  if (rateKey === "squareRate" && c.steepPitchSquaresQty > 0 && c.steepPitchAdder > 0) {
    const steepQty = c.steepPitchSquaresQty
    const steepUnitAdder = c.steepPitchAdder / steepQty
    detailRows.push({
      name: "Steep Pitch Adder (10%)",
      unit: steepUnitAdder,
      qty: steepQty,
      total: steepUnitAdder * steepQty,
    })
  }
  return detailRows
}

function buildMaterialListBody(
  breakdown: PricingBreakdown,
  calculations: QuoteCalculationsSnapshot,
): QuoteMaterialListCell[][] {
  const rows: QuoteMaterialListCell[][] = []
  for (const def of MATERIAL_RATE_ROWS) {
    const items = breakdown[def.rateKey]
    const quantity = Number(calculations[def.quantityKey])
    const categoryTotal = Number(calculations[def.calcKey])
    rows.push([
      {
        content: `${def.label} — ${formatCurrency(categoryTotal)}`,
        colSpan: 4,
        styles: { fontStyle: "bold" },
      },
    ])
    const details = buildDetailLines(def.rateKey, items, quantity, calculations)
    if (details.length === 0) {
      rows.push(["  (Pricing bundle — no itemized lines)", "", "", ""])
    } else {
      for (const d of details) {
        rows.push([
          `  ${d.name}`,
          formatCurrency(d.unit),
          formatCompactNumber(d.qty),
          formatCurrency(d.total),
        ])
      }
    }
  }
  return rows
}

export function buildQuoteExportPayload(params: {
  roofTypeId: string
  roofTypeName: string
  formData: QuoteFormSnapshot
  hasCedarShake: boolean
  calculations: QuoteCalculationsSnapshot
  breakdown: PricingBreakdown
  fees: FeeConfig
  profitMarginPct: number
  pipeLabels: { upTo6: string; upTo13: string; upTo19: string }
}): QuoteExportPayload {
  const {
    roofTypeId,
    roofTypeName,
    formData,
    hasCedarShake,
    calculations,
    breakdown,
    fees,
    profitMarginPct,
    pipeLabels,
  } = params

  const measurements: { label: string; value: string }[] = [
    { label: "Squares", value: formatCompactNumber(formData.squares) },
    { label: "Steep Pitch Squares", value: formatCompactNumber(formData.steepPitchSquares) },
    { label: "Ridge Length (ft)", value: formatCompactNumber(formData.ridgeLength) },
    { label: "Hip Length (ft)", value: formatCompactNumber(formData.hipLength) },
    { label: "Eave Length (ft)", value: formatCompactNumber(formData.eaveLength) },
    { label: "Rake Length (ft)", value: formatCompactNumber(formData.rakeLength) },
    { label: "Valley Length (ft)", value: formatCompactNumber(formData.valleyLength) },
    { label: "Wall Flashing (ft)", value: formatCompactNumber(formData.wallFlashing) },
    { label: "Step Flashing (ft)", value: formatCompactNumber(formData.stepFlashing) },
    { label: "Pitch Change (ft)", value: formatCompactNumber(formData.pitchChange) },
    { label: pipeLabels.upTo6, value: formatCompactNumber(formData.pipeFlashingUpTo6) },
    { label: pipeLabels.upTo13, value: formatCompactNumber(formData.pipeFlashingUpTo13) },
    { label: pipeLabels.upTo19, value: formatCompactNumber(formData.pipeFlashingUpTo19) },
    { label: "Ventilation (ft)", value: formatCompactNumber(formData.ventilation) },
    { label: "Snow Retention (ft)", value: formatCompactNumber(formData.snowRetention) },
    { label: "Tear-off layers", value: formatCompactNumber(formData.layers) },
    { label: "Cedar shake layers", value: hasCedarShake ? formatCompactNumber(formData.cedarShakeLayers) : "—" },
    {
      label: "Dumpster sizing (weighted sq)",
      value: calculations.dumpsterSquaresForTier > 0
        ? `${formatCompactNumber(calculations.dumpsterSquaresForTier)} (layers × sq = ${formatCompactNumber(formData.squares)} × ${formatCompactNumber(calculations.weightedLayers)})`
        : "—",
    },
  ]

  return {
    generatedAt: new Date().toISOString(),
    roofTypeId,
    roofTypeName,
    hasCedarShake,
    measurements,
    materialListBody: buildMaterialListBody(breakdown, calculations),
    feePercentages: {
      commissionPct: fees.commissionPct,
      financingPct: fees.financingPct,
      salesTaxPct: fees.salesTaxPct,
      goalProfitMarginPct: profitMarginPct,
    },
    totals: {
      materialSubtotal: calculations.materialSubtotal,
      subLabor: calculations.subLabor,
      dumpsterFee: calculations.dumpsterFee,
      satellite: fees.satellite,
      permits: fees.permits,
      salesTax: calculations.salesTax,
      financing: calculations.financing,
      totalFeesAndAdjustments: calculations.totalHardCosts,
      commission: calculations.commission,
      profit: calculations.profit,
      salePrice: calculations.salePrice,
      invalidMarginTarget: calculations.invalidMarginTarget,
    },
  }
}
