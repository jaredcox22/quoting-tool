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
  { pattern: "Preform Hip Cap", rate: "ridgeRate", multiplier: 0.1 },
  { pattern: "Hip", rate: "ridgeRate", multiplier: 0.1 },

  { pattern: "Extended Eave Trim", rate: "eaveRate", multiplier: 0.1 },
  { category: "Eaves", pattern: "High Temp Ice and Water Shield", rate: "eaveRate", multiplier: 2 / 60 },

  { pattern: "Gable trim", rate: "rakeRate", multiplier: 0.1 },

  { pattern: "Valley Metal", rate: "valleyRate", multiplier: 0.125 },
  { category: "Valleys", pattern: "High Temp Ice and Water Shield", rate: "valleyRate", multiplier: 1 / 60 },

  { pattern: "Sidewall Flashing", rate: "wallFlashingRate", multiplier: 0.1 },
  { pattern: "Endwall flashing", rate: "stepFlashingRate", multiplier: 0.1 },
  { pattern: "Pitch Change", rate: "pitchChangeRate", multiplier: 0.1 },
  { pattern: "Pipe flashing up to 6", rate: "pipeFlashingRate", multiplier: 1 },
  { pattern: "Ridge Vent", rate: "ventilationRate", multiplier: 1 },
  { pattern: "S-5-V Clamp", rate: "snowRetentionRate", multiplier: 0.75 },

  { pattern: "Flat Sheet", rate: "miscFixedCost", multiplier: 2 },
  { pattern: "Touch up Kit", rate: "miscFixedCost", multiplier: 2 },
  { pattern: "Pop Rivets", rate: "miscFixedCost", multiplier: 10 },
  { pattern: "Sealant", rate: "miscFixedCost", multiplier: 5 },
  { pattern: "Cap Nails", rate: "miscFixedCost", multiplier: 1 },
]

const CATEGORY_NAMES = [
  "Squares", "Ridges", "Eaves", "Rakes", "Valleys",
  "Wall Flashing", "Pipe Flashing", "Misc", "Ventilation", "Snow Retention",
]

const SKIP_CATEGORIES = ["Dumpster Fee", "Sub Labor"]

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

function parseCSVToAllPricing(csvText: string): RoofTypePricing {
  const lines = csvText.split("\n").filter((line) => line.trim().length > 0)

  const knownMultipliers = new Map<string, number>()
  let cat = ""
  for (const line of lines) {
    const cols = parseCSVRow(line)
    const itemName = cols[0]?.trim() ?? ""
    const colC = cols[2]?.trim() ?? ""

    if (!itemName) continue
    if (CATEGORY_NAMES.includes(itemName) || SKIP_CATEGORIES.includes(itemName)) {
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

    if (CATEGORY_NAMES.includes(itemName) || SKIP_CATEGORIES.includes(itemName)) {
      currentCategory = itemName
      continue
    }

    const typeId = SHEET_TYPE_TO_ID[typeRaw]
    if (!typeId) continue

    const isNumericMultiplier = colC !== "" && !colC.startsWith("$")
    let multiplier: number | null = null
    let cost: number | null = null

    if (isNumericMultiplier) {
      multiplier = parseFloat(colC.replace(/,/g, ""))
      if (isNaN(multiplier)) multiplier = null
      cost = parseDollarAmount(colD)
    } else {
      cost = parseDollarAmount(colC)
      multiplier = extractMultiplierFromDescription(description)
        ?? knownMultipliers.get(itemName)
        ?? findMapping(itemName, currentCategory)?.multiplier
        ?? null
    }

    if (multiplier === null || cost === null) continue

    const mapping = findMapping(itemName, currentCategory)
    if (!mapping) continue

    if (!result[typeId]) {
      result[typeId] = { rates: zeroPricing(), breakdown: {} }
    }

    const lineTotal = multiplier * cost
    result[typeId].rates[mapping.rate] += lineTotal

    if (!result[typeId].breakdown[mapping.rate]) {
      result[typeId].breakdown[mapping.rate] = []
    }
    result[typeId].breakdown[mapping.rate]!.push({
      name: itemName,
      multiplier,
      costPerUnit: cost,
      total: lineTotal,
    })
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

  return result
}

export async function fetchSheetPricing(
  sheetId: string,
  gid: string
): Promise<RoofTypePricing> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
  const isDev = process.env.NODE_ENV === "development"
  const response = await fetch(url, isDev ? { cache: "no-store" } : { next: { revalidate: 300 } })

  if (!response.ok) {
    throw new Error(`Google Sheets fetch failed: ${response.status}`)
  }

  const csvText = await response.text()
  return parseCSVToAllPricing(csvText)
}

export async function getPricing(): Promise<RoofTypePricing> {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const gid = process.env.GOOGLE_SHEET_GID

  if (!sheetId || !gid) {
    console.warn("Google Sheet config missing, using default pricing")
    return { "vertical-seam": { rates: defaultPricing, breakdown: {} } }
  }

  try {
    return await fetchSheetPricing(sheetId, gid)
  } catch (error) {
    console.warn("Failed to fetch sheet pricing, using defaults:", error)
    return { "vertical-seam": { rates: defaultPricing, breakdown: {} } }
  }
}
