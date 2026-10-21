import type { FeeConfig, LineItemDetail, PricingBreakdown, PricingData } from "@/lib/google-sheets"
import type { QuoteCalculationsSnapshot, QuoteFormSnapshot } from "@/lib/quote-export"

const LOCAL_SAVE_QUOTE_URL = "http://localhost:8080/quotingTool/saveQuote.php"
const PRODUCTION_SAVE_QUOTE_URL =
  "https://api.integrityprodserver.com/intserver-api/quotingTool/saveQuote.php"

const RATE_ROWS: readonly {
  rateKey: keyof PricingData
  quantityKey: keyof QuoteCalculationsSnapshot
}[] = [
  { rateKey: "squareRate", quantityKey: "squaresQty" },
  { rateKey: "ridgeRate", quantityKey: "ridgeQty" },
  { rateKey: "hipRate", quantityKey: "hipQty" },
  { rateKey: "eaveRate", quantityKey: "eaveQty" },
  { rateKey: "rakeRate", quantityKey: "rakeQty" },
  { rateKey: "valleyRate", quantityKey: "valleysQty" },
  { rateKey: "wallFlashingRate", quantityKey: "wallFlashingQty" },
  { rateKey: "stepFlashingRate", quantityKey: "stepFlashingQty" },
  { rateKey: "pitchChangeRate", quantityKey: "pitchChangeQty" },
  { rateKey: "pipeFlashingRate", quantityKey: "pipeFlashingQty" },
  { rateKey: "ventilationRate", quantityKey: "ventilationQty" },
  { rateKey: "snowRetentionRate", quantityKey: "snowRetentionQty" },
  { rateKey: "miscFixedCost", quantityKey: "miscFixedCostQty" },
]

export interface SaveQuoteLineItem {
  rate_key: string
  name: string
  multiplier: number
  cost_per_unit: number
  misc_unit?: "perJob" | "perSq"
  quantity: number
  total: number
}

export interface SaveQuoteResult {
  id: number
  lineItemCount: number
}

interface SaveQuoteResponse {
  success?: boolean
  error?: string
  id?: number
  line_item_count?: number
}

export function saveQuoteEndpoint(): string {
  const configured = process.env.NEXT_PUBLIC_SAVE_QUOTE_URL
  if (configured) return configured
  return process.env.NODE_ENV === "development" ? LOCAL_SAVE_QUOTE_URL : PRODUCTION_SAVE_QUOTE_URL
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function pricedAmount(value: number, invalidMarginTarget: boolean): number | null {
  if (invalidMarginTarget || !Number.isFinite(value)) return null
  return value
}

function billableUnits(
  rateKey: keyof PricingData,
  item: LineItemDetail,
  quantity: number,
  calculations: QuoteCalculationsSnapshot,
): number {
  const name = item.name.toLowerCase()
  if (rateKey === "pipeFlashingRate") {
    if (name.includes("up to 19")) return calculations.pipeFlashingQtyUpTo19
    if (name.includes("up to 13")) return calculations.pipeFlashingQtyUpTo13
    if (name.includes("up to 6")) return calculations.pipeFlashingQtyUpTo6
    return 0
  }

  const effectiveQty =
    rateKey === "miscFixedCost"
      ? item.miscUnit === "perSq"
        ? calculations.squaresQty
        : 1
      : quantity
  const rawUnits = item.multiplier * effectiveQty
  return item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits
}

/** Sheet breakdown lines that were charged on this estimate. Steep pitch stays on the quote row. */
export function buildStoredLineItems(
  breakdown: PricingBreakdown,
  calculations: QuoteCalculationsSnapshot,
): SaveQuoteLineItem[] {
  const lines: SaveQuoteLineItem[] = []
  for (const def of RATE_ROWS) {
    const items = breakdown[def.rateKey]
    if (!items || items.length === 0) continue
    const quantity = Number(calculations[def.quantityKey])
    if (def.rateKey !== "miscFixedCost" && !(quantity > 0)) continue
    for (const item of items) {
      const quantityForLine = billableUnits(def.rateKey, item, quantity, calculations)
      if (!(quantityForLine > 0)) continue
      const line: SaveQuoteLineItem = {
        rate_key: def.rateKey,
        name: item.name,
        multiplier: item.multiplier,
        cost_per_unit: item.costPerUnit,
        quantity: quantityForLine,
        total: item.costPerUnit * quantityForLine,
      }
      if (item.miscUnit) line.misc_unit = item.miscUnit
      lines.push(line)
    }
  }
  return lines
}

export function buildSaveQuoteBody(input: {
  cstId: string
  roofTypeId: string
  roofTypeName: string
  formData: QuoteFormSnapshot
  hasCedarShake: boolean
  profitMarginPct: number
  fees: FeeConfig
  calculations: QuoteCalculationsSnapshot
  breakdown: PricingBreakdown
}) {
  const { formData, fees, calculations } = input
  const invalid = calculations.invalidMarginTarget
  return {
    cst_id: input.cstId,
    roof_type_id: input.roofTypeId,
    roof_type_name: input.roofTypeName,
    has_cedar_shake: input.hasCedarShake,
    profit_margin_pct: finiteOrZero(input.profitMarginPct),
    squares: finiteOrZero(formData.squares),
    steep_pitch_squares: finiteOrZero(formData.steepPitchSquares),
    layers: finiteOrZero(formData.layers),
    cedar_shake_layers: finiteOrZero(formData.cedarShakeLayers),
    ridge_length: finiteOrZero(formData.ridgeLength),
    hip_length: finiteOrZero(formData.hipLength),
    eave_length: finiteOrZero(formData.eaveLength),
    rake_length: finiteOrZero(formData.rakeLength),
    valley_length: finiteOrZero(formData.valleyLength),
    wall_flashing: finiteOrZero(formData.wallFlashing),
    step_flashing: finiteOrZero(formData.stepFlashing),
    pitch_change: finiteOrZero(formData.pitchChange),
    pipe_flashing_up_to_6: finiteOrZero(formData.pipeFlashingUpTo6),
    pipe_flashing_up_to_13: finiteOrZero(formData.pipeFlashingUpTo13),
    pipe_flashing_up_to_19: finiteOrZero(formData.pipeFlashingUpTo19),
    ventilation: finiteOrZero(formData.ventilation),
    snow_retention: finiteOrZero(formData.snowRetention),
    commission_pct: finiteOrZero(fees.commissionPct),
    financing_pct: finiteOrZero(fees.financingPct),
    sales_tax_pct: finiteOrZero(fees.salesTaxPct),
    satellite: finiteOrZero(fees.satellite),
    permits: finiteOrZero(fees.permits),
    sub_labor_per_square: finiteOrZero(fees.subLaborPerSquare),
    sub_labor_per_ridge_ft: finiteOrZero(fees.subLaborPerRidgeFt),
    sub_labor_cedar_shake: finiteOrZero(fees.subLaborCedarShake),
    steep_pitch_adder: finiteOrZero(calculations.steepPitchAdder),
    squares_amount: finiteOrZero(calculations.squares),
    ridge_amount: finiteOrZero(calculations.ridge),
    hip_amount: finiteOrZero(calculations.hip),
    eave_amount: finiteOrZero(calculations.eave),
    rake_amount: finiteOrZero(calculations.rake),
    valleys_amount: finiteOrZero(calculations.valleys),
    wall_flashing_amount: finiteOrZero(calculations.wallFlashing),
    step_flashing_amount: finiteOrZero(calculations.stepFlashing),
    pitch_change_amount: finiteOrZero(calculations.pitchChange),
    pipe_flashing_amount: finiteOrZero(calculations.pipeFlashing),
    ventilation_amount: finiteOrZero(calculations.ventilation),
    snow_retention_amount: finiteOrZero(calculations.snowRetention),
    misc_fixed_cost_amount: finiteOrZero(calculations.miscFixedCost),
    material_subtotal: finiteOrZero(calculations.materialSubtotal),
    sub_labor_panels: finiteOrZero(calculations.subLaborPanels),
    sub_labor_ridge: finiteOrZero(calculations.subLaborRidge),
    sub_labor: finiteOrZero(calculations.subLabor),
    weighted_layers: finiteOrZero(calculations.weightedLayers),
    dumpster_squares_for_tier: Math.max(0, Math.trunc(calculations.dumpsterSquaresForTier)),
    dumpster_fee: finiteOrZero(calculations.dumpsterFee),
    sales_tax: finiteOrZero(calculations.salesTax),
    financing: pricedAmount(calculations.financing, invalid),
    total_hard_costs: pricedAmount(calculations.totalHardCosts, invalid),
    commission: pricedAmount(calculations.commission, invalid),
    profit: pricedAmount(calculations.profit, invalid),
    sale_price: pricedAmount(calculations.salePrice, invalid),
    invalid_margin_target: invalid,
    line_items: buildStoredLineItems(input.breakdown, calculations),
  }
}

export async function saveQuote(body: ReturnType<typeof buildSaveQuoteBody>): Promise<SaveQuoteResult> {
  let response: Response
  try {
    response = await fetch(saveQuoteEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Could not reach the save service.")
  }

  let payload: SaveQuoteResponse | null = null
  try {
    payload = (await response.json()) as SaveQuoteResponse
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.success !== true || typeof payload.id !== "number") {
    throw new Error(payload?.error || `Save failed (${response.status})`)
  }

  return {
    id: payload.id,
    lineItemCount: payload.line_item_count ?? 0,
  }
}
