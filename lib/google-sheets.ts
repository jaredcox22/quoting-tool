export interface PricingData {
  squareRate: number
  ridgeRate: number
  hipRate: number
  eaveRate: number
  rakeRate: number
  valleyRate: number
  wallFlashingRate: number
  stepFlashingRate: number
  pitchChangeRate: number
  pipeFlashingRate: number
  ventilationRate: number
  snowRetentionRate: number
  miscFixedCost: number
}

export interface LineItemDetail {
  name: string
  multiplier: number
  costPerUnit: number
  total: number
}

export type PricingBreakdown = Partial<Record<keyof PricingData, LineItemDetail[]>>

export interface RoofTypePricingEntry {
  rates: PricingData
  breakdown: PricingBreakdown
}

export type RoofTypePricing = Record<string, RoofTypePricingEntry>

export interface DumpsterTier {
  minSq: number
  maxSq: number
  cost: number
}

export interface FeeConfig {
  commissionPct: number
  financingPct: number
  salesTaxPct: number
  goalProfitMarginPct: number
  satellite: number
  permits: number
  dumpsterTiers: DumpsterTier[]
  subLaborPerSquare: number
  subLaborPerRidgeFt: number
}

export interface SheetData {
  pricing: RoofTypePricing
  fees: FeeConfig
}

export const defaultPricing: PricingData = {
  squareRate: 850,
  ridgeRate: 18,
  hipRate: 18,
  eaveRate: 12,
  rakeRate: 12,
  valleyRate: 22,
  wallFlashingRate: 15,
  stepFlashingRate: 14,
  pitchChangeRate: 75,
  pipeFlashingRate: 65,
  ventilationRate: 28,
  snowRetentionRate: 32,
  miscFixedCost: 0,
}

export const defaultFeeConfig: FeeConfig = {
  commissionPct: 8,
  financingPct: 4,
  salesTaxPct: 7.5,
  goalProfitMarginPct: 39,
  satellite: 10,
  permits: 200,
  dumpsterTiers: [
    { minSq: 1, maxSq: 20, cost: 360 },
    { minSq: 21, maxSq: 26, cost: 400 },
    { minSq: 27, maxSq: 35, cost: 430 },
    { minSq: 36, maxSq: 60, cost: 465 },
    { minSq: 61, maxSq: 90, cost: 535 },
  ],
  subLaborPerSquare: 200,
  subLaborPerRidgeFt: 0.5,
}

function zeroPricing(): PricingData {
  return {
    squareRate: 0, ridgeRate: 0, hipRate: 0, eaveRate: 0, rakeRate: 0,
    valleyRate: 0, wallFlashingRate: 0, stepFlashingRate: 0, pitchChangeRate: 0,
    pipeFlashingRate: 0, ventilationRate: 0, snowRetentionRate: 0, miscFixedCost: 0,
  }
}

const SHEET_TYPE_TO_ID: Record<string, string> = {
  "Vertical Seam": "vertical-seam",
  '1" SLR Panel': "1-slr-panel",
  "Ultra 2000 Exposed Fastener": "ultra-2000",
}

interface ItemMapping {
  category?: string
  pattern: string
  rate: keyof PricingData
  multiplier: number
}

const ITEM_MAPPINGS: ItemMapping[] = [
  { pattern: "Roofing panels", rate: "squareRate", multiplier: 75 },
  { pattern: "Synthetic underlayment", rate: "squareRate", multiplier: 0.1 },
  { pattern: '1" Clip Screws', rate: "squareRate", multiplier: 100 },
  { pattern: "Panel Clips", rate: "squareRate", multiplier: 25 },
  { pattern: "Panel Screws", rate: "squareRate", multiplier: 100 },

  { pattern: "Ridge Cap", rate: "ridgeRate", multiplier: 0.1 },
  { pattern: "Z Trim for ridge", rate: "ridgeRate", multiplier: 0.2 },
  { category: "Hips", pattern: "Preform Hip Cap", rate: "hipRate", multiplier: 0.1 },
  { category: "Hips", pattern: "Hip", rate: "hipRate", multiplier: 0.1 },

  { pattern: "Extended Eave Trim", rate: "eaveRate", multiplier: 0.1 },
  { category: "Eaves", pattern: "High Temp Ice and Water Shield", rate: "eaveRate", multiplier: 2 / 60 },

  { pattern: "Gable trim", rate: "rakeRate", multiplier: 0.1 },

  { pattern: "Valley Metal", rate: "valleyRate", multiplier: 0.125 },
  { category: "Valleys", pattern: "High Temp Ice and Water Shield", rate: "valleyRate", multiplier: 1 / 60 },

  { pattern: "Sidewall Flashing", rate: "wallFlashingRate", multiplier: 0.1 },
  { pattern: "Endwall flashing", rate: "stepFlashingRate", multiplier: 0.1 },
  { pattern: "Pitch Change", rate: "pitchChangeRate", multiplier: 0.1 },
  { pattern: "Pipe flashing up to 6", rate: "pipeFlashingRate", multiplier: 1 },
  { pattern: "High Temp Pipe flashing up to 13", rate: "pipeFlashingRate", multiplier: 1 },
  { pattern: "High Temp Pipe flashing up to 19", rate: "pipeFlashingRate", multiplier: 1 },
  { pattern: "Ridge Vent", rate: "ventilationRate", multiplier: 1 },
  { pattern: "S-5-V Clamp", rate: "snowRetentionRate", multiplier: 1 },
  { pattern: "VersaClip", rate: "snowRetentionRate", multiplier: 1 },
  { pattern: "SnoClip", rate: "snowRetentionRate", multiplier: 1 },
  { pattern: "Snow Fence", rate: "snowRetentionRate", multiplier: 1 },
  { pattern: "Colorgard", rate: "snowRetentionRate", multiplier: 1 },

  { pattern: "Flat Sheet", rate: "miscFixedCost", multiplier: 2 },
  { pattern: "Touch up Kit", rate: "miscFixedCost", multiplier: 2 },
  { pattern: "Pop Rivets", rate: "miscFixedCost", multiplier: 10 },
  { pattern: "Sealant", rate: "miscFixedCost", multiplier: 5 },
  { pattern: "Cap Nails", rate: "miscFixedCost", multiplier: 1 },
]

const CATEGORY_TO_RATE: Record<string, keyof PricingData> = {
  "Squares": "squareRate",
  "Ridges": "ridgeRate",
  "Hips": "hipRate",
  "Eaves": "eaveRate",
  "Rakes": "rakeRate",
  "Valleys": "valleyRate",
  "Wall Flashing": "wallFlashingRate",
  "Pipe Flashing": "pipeFlashingRate",
  "Misc": "miscFixedCost",
  "Ventilation": "ventilationRate",
  "Snow Retention": "snowRetentionRate",
}

const CATEGORY_NAMES = Object.keys(CATEGORY_TO_RATE)

const FEE_CATEGORIES = ["Dumpster Fees", "Sub Labor", "Additional Fees"]

function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

function parseDollarAmount(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, "").trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parsePercentage(value: string): number | null {
  const cleaned = value.replace(/%/g, "").trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function findMapping(itemName: string, currentCategory: string): ItemMapping | undefined {
  const trimmed = itemName.trim().toLowerCase()
  return ITEM_MAPPINGS.find((m) => {
    const nameMatch = trimmed.startsWith(m.pattern.toLowerCase())
    if (!nameMatch) return false
    if (m.category) return m.category === currentCategory
    return true
  })
}

function extractMultiplierFromDescription(description: string): number | null {
  const match = description.match(/^([\d.]+)\s+feet per square/)
  if (match) return parseFloat(match[1])
  return null
}

function parseDumpsterTier(label: string): { minSq: number; maxSq: number } | null {
  const match = label.match(/^(\d+)-(\d+)\s+Squares$/i)
  if (!match) return null
  return { minSq: parseInt(match[1]), maxSq: parseInt(match[2]) }
}

function parseCSV(csvText: string): SheetData {
  const lines = csvText.split("\n").filter((line) => line.trim().length > 0)

  const fees: FeeConfig = { ...defaultFeeConfig, dumpsterTiers: [] }

  // First pass: collect numeric multipliers
  const knownMultipliers = new Map<string, number>()
  let cat = ""
  for (const line of lines) {
    const cols = parseCSVRow(line)
    const itemName = cols[0]?.trim() ?? ""
    const colC = cols[2]?.trim() ?? ""

    if (!itemName) continue
    if (CATEGORY_NAMES.includes(itemName) || FEE_CATEGORIES.includes(itemName)) {
      cat = itemName
      continue
    }

    if (colC !== "" && !colC.startsWith("$")) {
      const num = parseFloat(colC.replace(/,/g, ""))
      if (!isNaN(num) && num > 0) {
        knownMultipliers.set(itemName, num)
      }
    }
  }

  // Second pass: build pricing per roof type + parse fee categories
  const result: RoofTypePricing = {}
  let currentCategory = ""

  for (const line of lines) {
    const cols = parseCSVRow(line)
    const itemName = cols[0]?.trim() ?? ""
    const description = cols[1]?.trim() ?? ""
    const colC = cols[2]?.trim() ?? ""
    const colD = cols[3]?.trim() ?? ""
    const typeRaw = cols[4]?.trim() ?? ""

    if (!itemName) continue

    if (CATEGORY_NAMES.includes(itemName) || FEE_CATEGORIES.includes(itemName)) {
      currentCategory = itemName
      continue
    }

    // Parse dumpster fee tiers
    if (currentCategory === "Dumpster Fees") {
      const tier = parseDumpsterTier(itemName)
      const cost = parseDollarAmount(colD) ?? parseDollarAmount(colC)
      if (tier && cost !== null) {
        fees.dumpsterTiers.push({ ...tier, cost })
      }
      continue
    }

    // Parse sub labor rates
    if (currentCategory === "Sub Labor") {
      const cost = parseDollarAmount(colD) ?? parseDollarAmount(colC)
      if (cost !== null) {
        const lower = itemName.toLowerCase()
        if (lower.includes("panel") || lower.includes("square")) {
          fees.subLaborPerSquare = cost
        } else if (lower.includes("ridge")) {
          fees.subLaborPerRidgeFt = cost
        }
      }
      continue
    }

    // Parse additional fees (Commission, Financing, Satellite, Permits, Sales Tax)
    if (currentCategory === "Additional Fees") {
      const lower = itemName.toLowerCase()
      const val = description || colC
      if (lower === "commission") {
        const n = parsePercentage(val); if (n !== null) fees.commissionPct = n
      } else if (lower === "financing") {
        const n = parsePercentage(val); if (n !== null) fees.financingPct = n
      } else if (lower === "sales tax") {
        const n = parsePercentage(val); if (n !== null) fees.salesTaxPct = n
      } else if (lower === "satellite") {
        const n = parseDollarAmount(val); if (n !== null) fees.satellite = n
      } else if (lower === "permits") {
        const n = parseDollarAmount(val); if (n !== null) fees.permits = n
      } else if (lower === "goal profit margin") {
        const n = parsePercentage(val); if (n !== null) fees.goalProfitMarginPct = n
      }
      continue
    }

    // Normal material items
    const isAll = typeRaw.toLowerCase() === "all"
    const typeIds = isAll
      ? Object.values(SHEET_TYPE_TO_ID)
      : SHEET_TYPE_TO_ID[typeRaw] ? [SHEET_TYPE_TO_ID[typeRaw]] : []
    if (typeIds.length === 0) continue

    const isNumericMultiplier = colC !== "" && !colC.startsWith("$")
    let multiplier: number | null = null
    let cost: number | null = null

    if (isNumericMultiplier) {
      multiplier = parseFloat(colC.replace(/,/g, ""))
      if (isNaN(multiplier)) multiplier = null
      cost = parseDollarAmount(colD)
    } else {
      cost = parseDollarAmount(colC) ?? parseDollarAmount(colD)
      multiplier = extractMultiplierFromDescription(description)
        ?? knownMultipliers.get(itemName)
        ?? findMapping(itemName, currentCategory)?.multiplier
        ?? null
    }

    if (multiplier === null || cost === null) continue

    const mapping = findMapping(itemName, currentCategory)
    const rateKey = mapping?.rate ?? CATEGORY_TO_RATE[currentCategory]
    if (!rateKey) continue

    const lineTotal = multiplier * cost

    for (const typeId of typeIds) {
      if (!result[typeId]) {
        result[typeId] = { rates: zeroPricing(), breakdown: {} }
      }

      result[typeId].rates[rateKey] += lineTotal

      if (!result[typeId].breakdown[rateKey]) {
        result[typeId].breakdown[rateKey] = []
      }
      result[typeId].breakdown[rateKey]!.push({
        name: itemName,
        multiplier,
        costPerUnit: cost,
        total: lineTotal,
      })
    }
  }

  // Fill missing rates and breakdowns from Vertical Seam
  const vsId = "vertical-seam"
  if (result[vsId]) {
    for (const [typeId, entry] of Object.entries(result)) {
      if (typeId === vsId) continue
      for (const key of Object.keys(entry.rates) as (keyof PricingData)[]) {
        if (entry.rates[key] === 0 && result[vsId].rates[key] > 0) {
          entry.rates[key] = result[vsId].rates[key]
          entry.breakdown[key] = result[vsId].breakdown[key]
        }
      }
    }
  }

  // Sort dumpster tiers by minSq
  fees.dumpsterTiers.sort((a, b) => a.minSq - b.minSq)

  return { pricing: result, fees }
}

export async function fetchSheetData(
  sheetId: string,
  gid: string
): Promise<SheetData> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Google Sheets fetch failed: ${response.status}`)
  }

  const csvText = await response.text()
  return parseCSV(csvText)
}

export async function getSheetData(): Promise<SheetData> {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const gid = process.env.GOOGLE_SHEET_GID

  if (!sheetId || !gid) {
    console.warn("Google Sheet config missing, using defaults")
    return {
      pricing: { "vertical-seam": { rates: defaultPricing, breakdown: {} } },
      fees: defaultFeeConfig,
    }
  }

  try {
    return await fetchSheetData(sheetId, gid)
  } catch (error) {
    console.warn("Failed to fetch sheet data, using defaults:", error)
    return {
      pricing: { "vertical-seam": { rates: defaultPricing, breakdown: {} } },
      fees: defaultFeeConfig,
    }
  }
}
