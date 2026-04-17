import type { FeeConfig } from "@/lib/google-sheets"

/** Keep in sync with FormData in components/roofing-calculator.tsx */
export interface PersistedFormData {
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

export type PersistedRoofType =
  | "vertical-seam"
  | "1-slr-panel"
  | "12-accent-panel"
  | "ultra-2000"

const STORAGE_KEY = "quoting-tool:roofing-calculator:v1"

const DEFAULT_FORM: PersistedFormData = {
  squares: 0,
  steepPitchSquares: 0,
  layers: 1,
  cedarShakeLayers: 0,
  ridgeLength: 0,
  hipLength: 0,
  eaveLength: 0,
  rakeLength: 0,
  valleyLength: 0,
  wallFlashing: 0,
  stepFlashing: 0,
  pitchChange: 0,
  pipeFlashingUpTo6: 0,
  pipeFlashingUpTo13: 0,
  pipeFlashingUpTo19: 0,
  ventilation: 0,
  snowRetention: 0,
}

const ROOF_IDS: readonly PersistedRoofType[] = [
  "vertical-seam",
  "1-slr-panel",
  "12-accent-panel",
  "ultra-2000",
]

export interface PersistedCalculatorSlice {
  selectedRoofType: PersistedRoofType
  formData: PersistedFormData
  hasCedarShake: boolean
  profitMarginPct: number
}

interface StoredPayloadV1 extends PersistedCalculatorSlice {
  v: 1
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function parseFormData(raw: unknown): PersistedFormData {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FORM }
  const o = raw as Record<string, unknown>
  const next = { ...DEFAULT_FORM }
  for (const key of Object.keys(DEFAULT_FORM) as (keyof PersistedFormData)[]) {
    const v = o[key]
    if (isFiniteNumber(v) && v >= 0) {
      next[key] = Math.max(0, v)
    }
  }
  if (next.steepPitchSquares > next.squares) {
    next.steepPitchSquares = next.squares
  }
  if (next.cedarShakeLayers > next.layers) {
    next.cedarShakeLayers = next.layers
  }
  return next
}

function parseRoofType(raw: unknown): PersistedRoofType | null {
  if (typeof raw !== "string") return null
  return ROOF_IDS.includes(raw as PersistedRoofType) ? (raw as PersistedRoofType) : null
}

/**
 * Reads persisted calculator state from localStorage (client-only).
 * Returns null if missing, corrupt, or wrong version.
 */
export function loadPersistedCalculatorState(): PersistedCalculatorSlice | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const v = (parsed as { v?: number }).v
    if (v !== 1) return null
    const p = parsed as StoredPayloadV1
    const selectedRoofType = parseRoofType(p.selectedRoofType)
    if (!selectedRoofType) return null
    const formData = parseFormData(p.formData)
    const hasCedarShake = typeof p.hasCedarShake === "boolean" ? p.hasCedarShake : false
    const profitMarginPct = isFiniteNumber(p.profitMarginPct) ? Math.max(0, p.profitMarginPct) : 0
    return { selectedRoofType, formData, hasCedarShake, profitMarginPct }
  } catch {
    return null
  }
}

function buildPayload(slice: PersistedCalculatorSlice): StoredPayloadV1 {
  return { v: 1, ...slice }
}

/**
 * Persists calculator fields indefinitely (until cleared or quota exceeded).
 */
export function savePersistedCalculatorState(slice: PersistedCalculatorSlice): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload(slice)))
  } catch {
    // QuotaExceededError or private mode — ignore
  }
}

export function clearPersistedCalculatorState(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clampProfitMarginToFees(pct: number, fees: FeeConfig): number {
  const max = Math.max(0, Math.floor(99 - fees.commissionPct))
  return Math.min(Math.max(0, pct), max)
}
