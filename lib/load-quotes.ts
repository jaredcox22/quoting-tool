import type { FeeConfig, LineItemDetail, PricingBreakdown, PricingData } from "@/lib/google-sheets"
import type { QuoteCalculationsSnapshot, QuoteFormSnapshot } from "@/lib/quote-export"
import { saveQuoteEndpoint, type SaveQuoteBody } from "@/lib/save-quote"

export interface SavedQuoteLineItem {
  id: number
  sort_order: number
  rate_key: string
  name: string
  multiplier: number
  cost_per_unit: number
  misc_unit: "perJob" | "perSq" | null
  quantity: number
  total: number
}

export interface SavedQuote {
  id: number
  cst_id: string
  created_at: string
  roof_type_id: string
  roof_type_name: string
  has_cedar_shake: boolean
  profit_margin_pct: number
  squares: number
  steep_pitch_squares: number
  layers: number
  cedar_shake_layers: number
  ridge_length: number
  hip_length: number
  eave_length: number
  rake_length: number
  valley_length: number
  wall_flashing: number
  step_flashing: number
  pitch_change: number
  pipe_flashing_up_to_6: number
  pipe_flashing_up_to_13: number
  pipe_flashing_up_to_19: number
  ventilation: number
  snow_retention: number
  commission_pct: number
  financing_pct: number
  sales_tax_pct: number
  satellite: number
  permits: number
  sub_labor_per_square: number
  sub_labor_per_ridge_ft: number
  sub_labor_cedar_shake: number
  steep_pitch_adder: number
  squares_amount: number
  ridge_amount: number
  hip_amount: number
  eave_amount: number
  rake_amount: number
  valleys_amount: number
  wall_flashing_amount: number
  step_flashing_amount: number
  pitch_change_amount: number
  pipe_flashing_amount: number
  ventilation_amount: number
  snow_retention_amount: number
  misc_fixed_cost_amount: number
  material_subtotal: number
  sub_labor_panels: number
  sub_labor_ridge: number
  sub_labor: number
  weighted_layers: number
  dumpster_squares_for_tier: number
  dumpster_fee: number
  sales_tax: number
  financing: number | null
  total_hard_costs: number | null
  commission: number | null
  profit: number | null
  sale_price: number | null
  invalid_margin_target: boolean
  line_items: SavedQuoteLineItem[]
}

const RATE_KEYS: readonly (keyof PricingData)[] = [
  "squareRate",
  "ridgeRate",
  "hipRate",
  "eaveRate",
  "rakeRate",
  "valleyRate",
  "wallFlashingRate",
  "stepFlashingRate",
  "pitchChangeRate",
  "pipeFlashingRate",
  "ventilationRate",
  "snowRetentionRate",
  "miscFixedCost",
]

export function loadQuotesEndpoint(): string {
  const saveUrl = saveQuoteEndpoint()
  if (saveUrl.endsWith("saveQuote.php")) {
    return saveUrl.replace(/saveQuote\.php$/, "loadQuotes.php")
  }
  return saveUrl.replace(/\/?$/, "/") + "loadQuotes.php"
}

export function formatQuoteSavedAt(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function formatQuoteMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = num(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true"
  return false
}

function parseLineItem(value: unknown): SavedQuoteLineItem | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const misc = row.misc_unit
  const miscUnit = misc === "perJob" || misc === "perSq" ? misc : null
  const name = typeof row.name === "string" ? row.name : ""
  const rateKey = typeof row.rate_key === "string" ? row.rate_key : ""
  if (!name || !rateKey) return null
  return {
    id: num(row.id),
    sort_order: num(row.sort_order),
    rate_key: rateKey,
    name,
    multiplier: num(row.multiplier),
    cost_per_unit: num(row.cost_per_unit),
    misc_unit: miscUnit,
    quantity: num(row.quantity),
    total: num(row.total),
  }
}

function parseQuote(value: unknown): SavedQuote | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.cst_id !== "string" && typeof row.cst_id !== "number") return null
  const lineItems = Array.isArray(row.line_items)
    ? row.line_items.map(parseLineItem).filter((item): item is SavedQuoteLineItem => item !== null)
    : []
  return {
    id: num(row.id),
    cst_id: String(row.cst_id),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    roof_type_id: typeof row.roof_type_id === "string" ? row.roof_type_id : "",
    roof_type_name: typeof row.roof_type_name === "string" ? row.roof_type_name : "",
    has_cedar_shake: bool(row.has_cedar_shake),
    profit_margin_pct: num(row.profit_margin_pct),
    squares: num(row.squares),
    steep_pitch_squares: num(row.steep_pitch_squares),
    layers: num(row.layers),
    cedar_shake_layers: num(row.cedar_shake_layers),
    ridge_length: num(row.ridge_length),
    hip_length: num(row.hip_length),
    eave_length: num(row.eave_length),
    rake_length: num(row.rake_length),
    valley_length: num(row.valley_length),
    wall_flashing: num(row.wall_flashing),
    step_flashing: num(row.step_flashing),
    pitch_change: num(row.pitch_change),
    pipe_flashing_up_to_6: num(row.pipe_flashing_up_to_6),
    pipe_flashing_up_to_13: num(row.pipe_flashing_up_to_13),
    pipe_flashing_up_to_19: num(row.pipe_flashing_up_to_19),
    ventilation: num(row.ventilation),
    snow_retention: num(row.snow_retention),
    commission_pct: num(row.commission_pct),
    financing_pct: num(row.financing_pct),
    sales_tax_pct: num(row.sales_tax_pct),
    satellite: num(row.satellite),
    permits: num(row.permits),
    sub_labor_per_square: num(row.sub_labor_per_square),
    sub_labor_per_ridge_ft: num(row.sub_labor_per_ridge_ft),
    sub_labor_cedar_shake: num(row.sub_labor_cedar_shake),
    steep_pitch_adder: num(row.steep_pitch_adder),
    squares_amount: num(row.squares_amount),
    ridge_amount: num(row.ridge_amount),
    hip_amount: num(row.hip_amount),
    eave_amount: num(row.eave_amount),
    rake_amount: num(row.rake_amount),
    valleys_amount: num(row.valleys_amount),
    wall_flashing_amount: num(row.wall_flashing_amount),
    step_flashing_amount: num(row.step_flashing_amount),
    pitch_change_amount: num(row.pitch_change_amount),
    pipe_flashing_amount: num(row.pipe_flashing_amount),
    ventilation_amount: num(row.ventilation_amount),
    snow_retention_amount: num(row.snow_retention_amount),
    misc_fixed_cost_amount: num(row.misc_fixed_cost_amount),
    material_subtotal: num(row.material_subtotal),
    sub_labor_panels: num(row.sub_labor_panels),
    sub_labor_ridge: num(row.sub_labor_ridge),
    sub_labor: num(row.sub_labor),
    weighted_layers: num(row.weighted_layers),
    dumpster_squares_for_tier: num(row.dumpster_squares_for_tier),
    dumpster_fee: num(row.dumpster_fee),
    sales_tax: num(row.sales_tax),
    financing: numOrNull(row.financing),
    total_hard_costs: numOrNull(row.total_hard_costs),
    commission: numOrNull(row.commission),
    profit: numOrNull(row.profit),
    sale_price: numOrNull(row.sale_price),
    invalid_margin_target: bool(row.invalid_margin_target),
    line_items: lineItems,
  }
}

export interface QuoteCustomer {
  cst_id: string
  first_name: string
  last_name: string
  cust_number: string | null
}

export interface LoadQuotesResult {
  quotes: SavedQuote[]
  customers: QuoteCustomer[] | null
  customersTruncated: boolean
}

export type QuoteSearchQuery = { cstId: string } | { name: string }

export function parseQuoteSearch(raw: string): QuoteSearchQuery | { error: string } {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) {
    return { error: "Enter a customer id or a name." }
  }
  if (text.length > 100) return { error: "That search is too long." }
  if (text.length < 2 && !/^\d+$/.test(text)) {
    return { error: "Enter at least 2 characters." }
  }
  return { name: text }
}

function parseCustomer(value: unknown): QuoteCustomer | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const cstId = row.cst_id == null ? "" : String(row.cst_id).trim()
  if (!cstId) return null
  const custNumber = row.cust_number == null || row.cust_number === "" ? null : String(row.cust_number).trim()
  return {
    cst_id: cstId,
    first_name: typeof row.first_name === "string" ? row.first_name : "",
    last_name: typeof row.last_name === "string" ? row.last_name : "",
    cust_number: custNumber || null,
  }
}

export async function loadQuotes(query: QuoteSearchQuery): Promise<LoadQuotesResult> {
  const url = new URL(loadQuotesEndpoint())
  if ("cstId" in query) {
    url.searchParams.set("cst_id", query.cstId)
  } else {
    url.searchParams.set("name", query.name)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), { method: "GET", cache: "no-store" })
  } catch {
    throw new Error("Could not reach the quote service.")
  }

  let payload: {
    success?: boolean
    error?: string
    quotes?: unknown
    customers?: unknown
    customers_truncated?: unknown
  } | null = null
  try {
    payload = (await response.json()) as {
      success?: boolean
      error?: string
      quotes?: unknown
      customers?: unknown
      customers_truncated?: unknown
    }
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.success !== true || !Array.isArray(payload.quotes)) {
    throw new Error(payload?.error || `Could not load quotes (${response.status})`)
  }

  const customers = Array.isArray(payload.customers)
    ? payload.customers.map(parseCustomer).filter((customer): customer is QuoteCustomer => customer !== null)
    : null

  return {
    quotes: payload.quotes.map(parseQuote).filter((quote): quote is SavedQuote => quote !== null),
    customers,
    customersTruncated: payload.customers_truncated === true,
  }
}

export function formDataFromSavedQuote(quote: SavedQuote): QuoteFormSnapshot {
  return {
    squares: quote.squares,
    steepPitchSquares: quote.steep_pitch_squares,
    layers: quote.layers,
    cedarShakeLayers: quote.cedar_shake_layers,
    ridgeLength: quote.ridge_length,
    hipLength: quote.hip_length,
    eaveLength: quote.eave_length,
    rakeLength: quote.rake_length,
    valleyLength: quote.valley_length,
    wallFlashing: quote.wall_flashing,
    stepFlashing: quote.step_flashing,
    pitchChange: quote.pitch_change,
    pipeFlashingUpTo6: quote.pipe_flashing_up_to_6,
    pipeFlashingUpTo13: quote.pipe_flashing_up_to_13,
    pipeFlashingUpTo19: quote.pipe_flashing_up_to_19,
    ventilation: quote.ventilation,
    snowRetention: quote.snow_retention,
  }
}

function priced(value: number | null): number {
  return value === null ? Number.POSITIVE_INFINITY : value
}

export function calculationsFromSavedQuote(quote: SavedQuote): QuoteCalculationsSnapshot {
  const steepPitchSquares = Math.min(quote.steep_pitch_squares, quote.squares)
  return {
    squaresQty: quote.squares,
    steepPitchSquaresQty: steepPitchSquares,
    steepPitchAdder: quote.steep_pitch_adder,
    ridgeQty: Math.ceil(quote.ridge_length),
    hipQty: Math.ceil(quote.hip_length),
    eaveQty: Math.ceil(quote.eave_length),
    rakeQty: Math.ceil(quote.rake_length),
    valleysQty: Math.ceil(quote.valley_length),
    wallFlashingQty: Math.ceil(quote.wall_flashing),
    stepFlashingQty: Math.ceil(quote.step_flashing),
    pitchChangeQty: quote.pitch_change,
    pipeFlashingQty: quote.pipe_flashing_up_to_6 + quote.pipe_flashing_up_to_13 + quote.pipe_flashing_up_to_19,
    pipeFlashingQtyUpTo6: quote.pipe_flashing_up_to_6,
    pipeFlashingQtyUpTo13: quote.pipe_flashing_up_to_13,
    pipeFlashingQtyUpTo19: quote.pipe_flashing_up_to_19,
    ventilationQty: Math.ceil(quote.ventilation),
    snowRetentionQty: Math.ceil(quote.snow_retention),
    miscFixedCostQty: 1,
    squares: quote.squares_amount,
    ridge: quote.ridge_amount,
    hip: quote.hip_amount,
    eave: quote.eave_amount,
    rake: quote.rake_amount,
    valleys: quote.valleys_amount,
    wallFlashing: quote.wall_flashing_amount,
    stepFlashing: quote.step_flashing_amount,
    pitchChange: quote.pitch_change_amount,
    pipeFlashing: quote.pipe_flashing_amount,
    ventilation: quote.ventilation_amount,
    snowRetention: quote.snow_retention_amount,
    miscFixedCost: quote.misc_fixed_cost_amount,
    dumpsterSquaresForTier: quote.dumpster_squares_for_tier,
    weightedLayers: quote.weighted_layers,
    materialSubtotal: quote.material_subtotal,
    subLabor: quote.sub_labor,
    subLaborPanels: quote.sub_labor_panels,
    subLaborRidge: quote.sub_labor_ridge,
    dumpsterFee: quote.dumpster_fee,
    financing: priced(quote.financing),
    salesTax: quote.sales_tax,
    totalHardCosts: priced(quote.total_hard_costs),
    commission: priced(quote.commission),
    profit: priced(quote.profit),
    salePrice: priced(quote.sale_price),
    invalidMarginTarget: quote.invalid_margin_target,
  }
}

export function breakdownFromSavedQuote(quote: SavedQuote): PricingBreakdown {
  const breakdown: PricingBreakdown = {}
  for (const item of quote.line_items) {
    if (!RATE_KEYS.includes(item.rate_key as keyof PricingData)) continue
    const rateKey = item.rate_key as keyof PricingData
    const detail: LineItemDetail = {
      name: item.name,
      multiplier: item.multiplier,
      costPerUnit: item.cost_per_unit,
      total: item.total,
      ...(item.misc_unit ? { miscUnit: item.misc_unit } : {}),
    }
    if (!breakdown[rateKey]) breakdown[rateKey] = []
    breakdown[rateKey]!.push(detail)
  }
  return breakdown
}

export function feeConfigFromSavedQuote(quote: SavedQuote): FeeConfig {
  return {
    commissionPct: quote.commission_pct,
    financingPct: quote.financing_pct,
    salesTaxPct: quote.sales_tax_pct,
    goalProfitMarginPct: quote.profit_margin_pct,
    satellite: quote.satellite,
    permits: quote.permits,
    dumpsterTiers: [],
    subLaborPerSquare: quote.sub_labor_per_square,
    subLaborPerRidgeFt: quote.sub_labor_per_ridge_ft,
    subLaborCedarShake: quote.sub_labor_cedar_shake,
  }
}

export function savedQuoteFromSaveBody(id: number, body: SaveQuoteBody): SavedQuote {
  return {
    id,
    cst_id: body.cst_id,
    created_at: new Date().toISOString(),
    roof_type_id: body.roof_type_id,
    roof_type_name: body.roof_type_name,
    has_cedar_shake: body.has_cedar_shake,
    profit_margin_pct: body.profit_margin_pct,
    squares: body.squares,
    steep_pitch_squares: body.steep_pitch_squares,
    layers: body.layers,
    cedar_shake_layers: body.cedar_shake_layers,
    ridge_length: body.ridge_length,
    hip_length: body.hip_length,
    eave_length: body.eave_length,
    rake_length: body.rake_length,
    valley_length: body.valley_length,
    wall_flashing: body.wall_flashing,
    step_flashing: body.step_flashing,
    pitch_change: body.pitch_change,
    pipe_flashing_up_to_6: body.pipe_flashing_up_to_6,
    pipe_flashing_up_to_13: body.pipe_flashing_up_to_13,
    pipe_flashing_up_to_19: body.pipe_flashing_up_to_19,
    ventilation: body.ventilation,
    snow_retention: body.snow_retention,
    commission_pct: body.commission_pct,
    financing_pct: body.financing_pct,
    sales_tax_pct: body.sales_tax_pct,
    satellite: body.satellite,
    permits: body.permits,
    sub_labor_per_square: body.sub_labor_per_square,
    sub_labor_per_ridge_ft: body.sub_labor_per_ridge_ft,
    sub_labor_cedar_shake: body.sub_labor_cedar_shake,
    steep_pitch_adder: body.steep_pitch_adder,
    squares_amount: body.squares_amount,
    ridge_amount: body.ridge_amount,
    hip_amount: body.hip_amount,
    eave_amount: body.eave_amount,
    rake_amount: body.rake_amount,
    valleys_amount: body.valleys_amount,
    wall_flashing_amount: body.wall_flashing_amount,
    step_flashing_amount: body.step_flashing_amount,
    pitch_change_amount: body.pitch_change_amount,
    pipe_flashing_amount: body.pipe_flashing_amount,
    ventilation_amount: body.ventilation_amount,
    snow_retention_amount: body.snow_retention_amount,
    misc_fixed_cost_amount: body.misc_fixed_cost_amount,
    material_subtotal: body.material_subtotal,
    sub_labor_panels: body.sub_labor_panels,
    sub_labor_ridge: body.sub_labor_ridge,
    sub_labor: body.sub_labor,
    weighted_layers: body.weighted_layers,
    dumpster_squares_for_tier: body.dumpster_squares_for_tier,
    dumpster_fee: body.dumpster_fee,
    sales_tax: body.sales_tax,
    financing: body.financing,
    total_hard_costs: body.total_hard_costs,
    commission: body.commission,
    profit: body.profit,
    sale_price: body.sale_price,
    invalid_margin_target: body.invalid_margin_target,
    line_items: body.line_items.map((item, index) => ({
      id: index,
      sort_order: index,
      rate_key: item.rate_key,
      name: item.name,
      multiplier: item.multiplier,
      cost_per_unit: item.cost_per_unit,
      misc_unit: item.misc_unit ?? null,
      quantity: item.quantity,
      total: item.total,
    })),
  }
}
