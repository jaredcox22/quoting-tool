import type { FeeConfig } from "@/lib/google-sheets"

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

export interface QuoteExportPayload {
  generatedAt: string
  roofTypeId: string
  roofTypeName: string
  hasCedarShake: boolean
  measurements: { label: string; value: string }[]
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

export function buildQuoteExportPayload(params: {
  roofTypeId: string
  roofTypeName: string
  formData: QuoteFormSnapshot
  hasCedarShake: boolean
  calculations: QuoteCalculationsSnapshot
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
