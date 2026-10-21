"use client"

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import {
  Ruler,
  RotateCcw,
  Layers,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Save,
} from "lucide-react"
import type { RoofTypePricing, PricingData, PricingBreakdown, LineItemDetail, FeeConfig } from "@/lib/google-sheets"
import { defaultPricing, defaultFeeConfig, defaultSheetData, loadSheetDataFromEnv } from "@/lib/google-sheets"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buildQuoteExportPayload } from "@/lib/quote-export"
import { buildSaveQuoteBody, saveQuote } from "@/lib/save-quote"
import {
  breakdownFromSavedQuote,
  calculationsFromSavedQuote,
  feeConfigFromSavedQuote,
  formDataFromSavedQuote,
  formatQuoteMoney,
  formatQuoteSavedAt,
  loadQuotes,
  type SavedQuote,
} from "@/lib/load-quotes"
import { cn } from "@/lib/utils"
import {
  clearPersistedCalculatorState,
  clampProfitMarginToFees,
  loadPersistedCalculatorState,
  savePersistedCalculatorState,
} from "@/lib/roofing-calculator-persist"

type RoofType = "vertical-seam" | "1-slr-panel" | "12-accent-panel" | "ultra-2000"

function isRoofType(value: string): value is RoofType {
  return (
    value === "vertical-seam" ||
    value === "1-slr-panel" ||
    value === "12-accent-panel" ||
    value === "ultra-2000"
  )
}

interface FormData {
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

const EMPTY_PRICING_BREAKDOWN: PricingBreakdown = {}

const initialFormData: FormData = {
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

const roofTypes = [
  {
    id: "vertical-seam" as const,
    name: "Vertical Seam",
    description: "Classic concealed fastener profile with clean, vertical lines",
  },
  {
    id: "1-slr-panel" as const,
    name: '1" SLR Panel',
    description: "Standing Lock Rib panel with superior weather resistance",
  },
  {
    id: "ultra-2000" as const,
    name: "Ultra 2000 Exposed",
    description: "Cost-effective exposed fastener system with durability",
  },
]

export default function RoofingCalculator() {
  const searchParams = useSearchParams()
  const admin = searchParams.get("admin") === "true"
  const cstId = (searchParams.get("cst_id") ?? "").trim()

  const [pricingByType, setPricingByType] = useState<RoofTypePricing>(() => defaultSheetData().pricing)
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(() => defaultFeeConfig)
  const [sheetStatus, setSheetStatus] = useState<"loading" | "ready">("loading")
  const [sheetUsedFallback, setSheetUsedFallback] = useState(false)

  const [selectedRoofType, setSelectedRoofType] = useState<RoofType>("vertical-seam")
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [hasCedarShake, setHasCedarShake] = useState(false)
  const [savingQuote, setSavingQuote] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const [quotesStatus, setQuotesStatus] = useState<"loading" | "ready" | "error">(cstId ? "loading" : "ready")
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [frozenQuote, setFrozenQuote] = useState<SavedQuote | null>(null)
  const [quoteLoadId, setQuoteLoadId] = useState(0)

  const fees = feeConfig ?? defaultFeeConfig
  const maxGoalProfitMargin = Math.max(0, Math.floor(99 - fees.commissionPct))
  const [profitMarginPct, setProfitMarginPct] = useState(
    Math.min(fees.goalProfitMarginPct, maxGoalProfitMargin)
  )

  useEffect(() => {
    if (frozenQuote) return
    setProfitMarginPct((prev) => Math.min(prev, maxGoalProfitMargin))
  }, [maxGoalProfitMargin, frozenQuote])

  useEffect(() => {
    let cancelled = false
    void loadSheetDataFromEnv().then(({ data, usedFallback }) => {
      if (cancelled) return
      setPricingByType(data.pricing)
      setFeeConfig(data.fees)
      setSheetUsedFallback(usedFallback)
      setSheetStatus("ready")
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (frozenQuote) return
    const fee = feeConfig ?? defaultFeeConfig
    setProfitMarginPct((prev) => clampProfitMarginToFees(prev, fee))
  }, [feeConfig, frozenQuote])

  useEffect(() => {
    if (formData.layers <= 0 && hasCedarShake) {
      setHasCedarShake(false)
      setFormData((prev) => ({ ...prev, cedarShakeLayers: 0 }))
    }
  }, [formData.layers, hasCedarShake])

  const persistReadyRef = useRef(false)
  const persistGenerationRef = useRef(0)

  useLayoutEffect(() => {
    if (cstId) {
      persistReadyRef.current = true
      return
    }
    const saved = loadPersistedCalculatorState()
    const fee = feeConfig ?? defaultFeeConfig
    if (saved) {
      setSelectedRoofType(saved.selectedRoofType)
      setFormData(saved.formData)
      setHasCedarShake(saved.hasCedarShake)
      setProfitMarginPct(clampProfitMarginToFees(saved.profitMarginPct, fee))
    }
    persistReadyRef.current = true
    // Intentionally once on mount — a SalesPro customer loads from the database instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!cstId) {
      setQuotesStatus("ready")
      setChooserOpen(false)
      setSavedQuotes([])
      setQuotesError(null)
      return
    }
    let cancelled = false
    setQuotesStatus("loading")
    void loadQuotes(cstId)
      .then((quotes) => {
        if (cancelled) return
        setSavedQuotes(quotes)
        setQuotesError(null)
        setQuotesStatus("ready")
        setChooserOpen(quotes.length > 0)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setQuotesError(error instanceof Error ? error.message : "Could not load saved quotes.")
        setQuotesStatus("error")
        setChooserOpen(false)
      })
    return () => {
      cancelled = true
    }
  }, [cstId, quoteLoadId])

  useEffect(() => {
    if (!persistReadyRef.current || cstId) return
    const slice = {
      selectedRoofType,
      formData,
      hasCedarShake,
      profitMarginPct,
    }
    const generation = persistGenerationRef.current
    const id = window.setTimeout(() => {
      if (generation !== persistGenerationRef.current) return
      savePersistedCalculatorState(slice)
    }, 300)
    return () => window.clearTimeout(id)
  }, [formData, selectedRoofType, hasCedarShake, profitMarginPct, cstId])

  const pageHeaderRef = useRef<HTMLElement | null>(null)
  const [summaryFillsViewport, setSummaryFillsViewport] = useState(false)

  useEffect(() => {
    const el = pageHeaderRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => {
        setSummaryFillsViewport(!entry.isIntersecting)
      },
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFrozenQuote(null)
    const numValue = value === "" ? 0 : parseFloat(value)
    const safeValue = isNaN(numValue) ? 0 : numValue

    setFormData((prev) => {
      if (field === "squares") {
        const nextSquares = Math.max(0, safeValue)
        return {
          ...prev,
          squares: nextSquares,
          steepPitchSquares: Math.min(prev.steepPitchSquares, nextSquares),
        }
      }

      if (field === "steepPitchSquares") {
        return {
          ...prev,
          steepPitchSquares: Math.min(Math.max(0, safeValue), prev.squares),
        }
      }

      if (field === "layers") {
        const nextLayers = Math.max(0, safeValue)
        return {
          ...prev,
          layers: nextLayers,
          cedarShakeLayers: Math.min(prev.cedarShakeLayers, nextLayers),
        }
      }

      if (field === "cedarShakeLayers") {
        return {
          ...prev,
          cedarShakeLayers: Math.min(Math.max(0, safeValue), prev.layers),
        }
      }

      return { ...prev, [field]: Math.max(0, safeValue) }
    })
  }

  const startNewEstimate = () => {
    persistGenerationRef.current += 1
    clearPersistedCalculatorState()
    setFormData(initialFormData)
    setHasCedarShake(false)
    setSelectedRoofType("vertical-seam")
    setProfitMarginPct(Math.min(fees.goalProfitMarginPct, maxGoalProfitMargin))
    setFrozenQuote(null)
    setSaveMessage(null)
    setChooserOpen(false)
    setQuotesStatus("ready")
  }

  const openSavedQuote = (quote: SavedQuote) => {
    setSelectedRoofType(isRoofType(quote.roof_type_id) ? quote.roof_type_id : "vertical-seam")
    setFormData(formDataFromSavedQuote(quote))
    setHasCedarShake(quote.has_cedar_shake)
    setProfitMarginPct(quote.profit_margin_pct)
    setFrozenQuote(quote)
    setSaveMessage(null)
    setChooserOpen(false)
  }

  const handleReset = () => {
    startNewEstimate()
  }

  const entry = pricingByType?.[selectedRoofType]
    ?? pricingByType?.["vertical-seam"]
    ?? { rates: defaultPricing, breakdown: {} }

  const pricing: PricingData = entry.rates ?? defaultPricing
  const breakdown: PricingBreakdown = entry.breakdown ?? EMPTY_PRICING_BREAKDOWN
  const pipeItems = breakdown.pipeFlashingRate ?? []
  const pipeLabelUpTo6 = pipeItems.find((i) => i.name.toLowerCase().includes("up to 6"))?.name ?? 'Pipe Flashing up to 6"'
  const pipeLabelUpTo13 = pipeItems.find((i) => i.name.toLowerCase().includes("up to 13"))?.name ?? 'High Temp Pipe Flashing up to 13"'
  const pipeLabelUpTo19 = pipeItems.find((i) => i.name.toLowerCase().includes("up to 19"))?.name ?? 'High Temp Pipe Flashing up to 19"'

  const calculations = useMemo(() => {
    const ridgeLength = Math.ceil(formData.ridgeLength)
    const hipLength = Math.ceil(formData.hipLength)
    const eaveLength = Math.ceil(formData.eaveLength)
    const rakeLength = Math.ceil(formData.rakeLength)
    const valleyLength = Math.ceil(formData.valleyLength)
    const wallFlashingLength = Math.ceil(formData.wallFlashing)
    const stepFlashingLength = Math.ceil(formData.stepFlashing)
    const ventilationLength = Math.ceil(formData.ventilation)
    const snowRetentionLength = Math.ceil(formData.snowRetention)

    const computeLineTotal = (
      rateKey: keyof PricingData,
      quantity: number,
      roofSquaresForMisc?: number
    ) => {
      const items = breakdown[rateKey]
      if (!items || items.length === 0) {
        return quantity * pricing[rateKey]
      }

      return items.reduce((sum, item) => {
        let effectiveQty = quantity
        if (rateKey === "miscFixedCost") {
          const basis = item.miscUnit ?? "perJob"
          effectiveQty = basis === "perSq" ? (roofSquaresForMisc ?? 0) : 1
        } else if (quantity <= 0) {
          return sum
        }

        const rawUnits = item.multiplier * effectiveQty
        const billableUnits = item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits
        return sum + billableUnits * item.costPerUnit
      }, 0)
    }

    const computePipeFlashingTotal = () => {
      const items = breakdown.pipeFlashingRate ?? []
      if (items.length === 0) {
        const totalQty = formData.pipeFlashingUpTo6 + formData.pipeFlashingUpTo13 + formData.pipeFlashingUpTo19
        return totalQty * pricing.pipeFlashingRate
      }

      const matchQtyForItem = (itemName: string) => {
        const name = itemName.toLowerCase()
        if (name.includes("up to 19")) return formData.pipeFlashingUpTo19
        if (name.includes("up to 13")) return formData.pipeFlashingUpTo13
        if (name.includes("up to 6")) return formData.pipeFlashingUpTo6
        return 0
      }

      return items.reduce((sum, item) => sum + (item.costPerUnit * matchQtyForItem(item.name)), 0)
    }

    const steepPitchSquares = Math.min(formData.steepPitchSquares, formData.squares)
    const baseSquaresCost = computeLineTotal("squareRate", formData.squares)
    const steepPitchAdder = steepPitchSquares * pricing.squareRate * 0.1
    const squares = baseSquaresCost + steepPitchAdder
    const ridge = computeLineTotal("ridgeRate", ridgeLength)
    const hip = computeLineTotal("hipRate", hipLength)
    const eave = computeLineTotal("eaveRate", eaveLength)
    const rake = computeLineTotal("rakeRate", rakeLength)
    const valleys = computeLineTotal("valleyRate", valleyLength)
    const wallFlashing = computeLineTotal("wallFlashingRate", wallFlashingLength)
    const stepFlashing = computeLineTotal("stepFlashingRate", stepFlashingLength)
    const pitchChange = computeLineTotal("pitchChangeRate", formData.pitchChange)
    const pipeFlashing = computePipeFlashingTotal()
    const ventilation = computeLineTotal("ventilationRate", ventilationLength)
    const snowRetention = computeLineTotal("snowRetentionRate", snowRetentionLength)
    const miscFixedCost = computeLineTotal("miscFixedCost", 1, formData.squares)

    const materialSubtotal =
      squares + ridge + hip + eave + rake + valleys +
      wallFlashing + stepFlashing + pitchChange + pipeFlashing +
      ventilation + snowRetention + miscFixedCost

    const subLaborPanels = formData.squares * fees.subLaborPerSquare
    const subLaborRidge = ridgeLength * fees.subLaborPerRidgeFt
    const subLaborCedarShake = formData.cedarShakeLayers * fees.subLaborCedarShake
    const subLabor = subLaborPanels + subLaborRidge + subLaborCedarShake

    const effectiveCedarShakeLayers = hasCedarShake
      ? Math.min(formData.cedarShakeLayers, formData.layers)
      : 0
    // Cedar shake layers are included in total layers and carry +0.5 extra weight.
    const weightedLayers = formData.layers + (effectiveCedarShakeLayers * 0.5)
    const dumpsterSquaresForTier = Math.ceil(formData.squares * weightedLayers)
    const dumpsterFee = fees.dumpsterTiers.find(
      (t) => dumpsterSquaresForTier >= t.minSq && dumpsterSquaresForTier <= t.maxSq
    )?.cost ?? 0

    const salesTax = materialSubtotal * (fees.salesTaxPct / 100)

    const preFinancingSubtotal =
      materialSubtotal + subLabor + dumpsterFee +
      fees.satellite + fees.permits + salesTax

    const financingDecimal = fees.financingPct / 100
    const marginDecimal = profitMarginPct / 100
    const commissionDecimal = fees.commissionPct / 100
    const divisor = 1 - marginDecimal - commissionDecimal - financingDecimal

    // Financing, commission, and profit margin are all percentages of sale price.
    // If they sum to >= 100%, there is no finite sale price.
    const invalidMarginTarget = divisor <= 0
    const salePrice = invalidMarginTarget ? Number.POSITIVE_INFINITY : preFinancingSubtotal / divisor
    const financing = invalidMarginTarget ? Number.POSITIVE_INFINITY : salePrice * financingDecimal
    const totalHardCosts = invalidMarginTarget ? Number.POSITIVE_INFINITY : preFinancingSubtotal + financing
    const commission = invalidMarginTarget ? Number.POSITIVE_INFINITY : salePrice * commissionDecimal
    const profit = invalidMarginTarget ? Number.POSITIVE_INFINITY : salePrice - totalHardCosts - commission

    return {
      squaresQty: formData.squares,
      steepPitchSquaresQty: steepPitchSquares,
      ridgeQty: ridgeLength,
      hipQty: hipLength,
      eaveQty: eaveLength,
      rakeQty: rakeLength,
      valleysQty: valleyLength,
      wallFlashingQty: wallFlashingLength,
      stepFlashingQty: stepFlashingLength,
      pitchChangeQty: formData.pitchChange,
      pipeFlashingQty: formData.pipeFlashingUpTo6 + formData.pipeFlashingUpTo13 + formData.pipeFlashingUpTo19,
      pipeFlashingQtyUpTo6: formData.pipeFlashingUpTo6,
      pipeFlashingQtyUpTo13: formData.pipeFlashingUpTo13,
      pipeFlashingQtyUpTo19: formData.pipeFlashingUpTo19,
      ventilationQty: ventilationLength,
      snowRetentionQty: snowRetentionLength,
      miscFixedCostQty: 1,
      squares,
      steepPitchAdder,
      ridge,
      hip,
      eave,
      rake,
      valleys,
      wallFlashing,
      stepFlashing,
      pitchChange,
      pipeFlashing,
      ventilation,
      snowRetention,
      miscFixedCost,
      materialSubtotal,
      subLaborPanels,
      subLaborRidge,
      subLabor,
      weightedLayers,
      dumpsterSquaresForTier,
      dumpsterFee,
      financing,
      salesTax,
      totalHardCosts,
      invalidMarginTarget,
      commission,
      profit,
      salePrice,
    }
  }, [formData, pricing, breakdown, fees, profitMarginPct, hasCedarShake])

  const summaryFees = frozenQuote ? feeConfigFromSavedQuote(frozenQuote) : fees
  const summaryBreakdown = frozenQuote ? breakdownFromSavedQuote(frozenQuote) : breakdown
  const summaryCalculations = frozenQuote ? calculationsFromSavedQuote(frozenQuote) : calculations
  const summaryPipeItems = summaryBreakdown.pipeFlashingRate ?? []
  const summaryPipeLabelUpTo6 = summaryPipeItems.find((item) => item.name.toLowerCase().includes("up to 6"))?.name ?? pipeLabelUpTo6
  const summaryPipeLabelUpTo13 = summaryPipeItems.find((item) => item.name.toLowerCase().includes("up to 13"))?.name ?? pipeLabelUpTo13
  const summaryPipeLabelUpTo19 = summaryPipeItems.find((item) => item.name.toLowerCase().includes("up to 19"))?.name ?? pipeLabelUpTo19
  const marginMax = frozenQuote
    ? Math.max(0, Math.floor(99 - summaryFees.commissionPct), Math.ceil(profitMarginPct))
    : maxGoalProfitMargin

  const refreshSavedQuotes = useCallback(() => {
    if (!cstId) return
    void loadQuotes(cstId)
      .then((quotes) => {
        setSavedQuotes(quotes)
      })
      .catch(() => {
        // The estimate is already saved. The list refreshes the next time the page opens.
      })
  }, [cstId])

  const handleSaveQuote = useCallback(() => {
    if (!cstId || savingQuote || sheetStatus !== "ready" || frozenQuote) return
    const roofTypeName = roofTypes.find((t) => t.id === selectedRoofType)?.name ?? selectedRoofType
    const body = buildSaveQuoteBody({
      cstId,
      roofTypeId: selectedRoofType,
      roofTypeName,
      formData,
      hasCedarShake,
      profitMarginPct,
      fees,
      calculations,
      breakdown,
    })
    setSavingQuote(true)
    setSaveMessage(null)
    void saveQuote(body)
      .then((result) => {
        setSaveMessage({ tone: "ok", text: `Saved estimate ${result.id}.` })
        refreshSavedQuotes()
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : "Save failed."
        setSaveMessage({ tone: "error", text })
      })
      .finally(() => {
        setSavingQuote(false)
      })
  }, [
    cstId,
    savingQuote,
    sheetStatus,
    selectedRoofType,
    formData,
    hasCedarShake,
    profitMarginPct,
    fees,
    calculations,
    breakdown,
    refreshSavedQuotes,
    frozenQuote,
  ])

  const handleExportPdf = useCallback(() => {
    const roofTypeName = frozenQuote?.roof_type_name
      ?? roofTypes.find((t) => t.id === selectedRoofType)?.name
      ?? selectedRoofType
    const payload = buildQuoteExportPayload({
      roofTypeId: selectedRoofType,
      roofTypeName,
      formData,
      hasCedarShake,
      calculations: summaryCalculations,
      breakdown: summaryBreakdown,
      fees: summaryFees,
      profitMarginPct,
      pipeLabels: {
        upTo6: summaryPipeLabelUpTo6,
        upTo13: summaryPipeLabelUpTo13,
        upTo19: summaryPipeLabelUpTo19,
      },
    })
    void import("@/lib/quote-export-pdf").then(({ exportQuoteToPdf }) => {
      exportQuoteToPdf(payload)
      persistGenerationRef.current += 1
      clearPersistedCalculatorState()
    })
  }, [
    selectedRoofType,
    formData,
    hasCedarShake,
    summaryCalculations,
    summaryBreakdown,
    summaryFees,
    profitMarginPct,
    summaryPipeLabelUpTo6,
    summaryPipeLabelUpTo13,
    summaryPipeLabelUpTo19,
    frozenQuote,
  ])

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="relative min-h-screen bg-background">
      {sheetStatus === "loading" && (!cstId || (quotesStatus === "ready" && !chooserOpen)) && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading pricing…</p>
        </div>
      )}
      <header ref={pageHeaderRef} className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl text-balance">
                  Roofing Calculator
                </h1>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base text-pretty max-w-2xl">
                Generate a fast, professional estimate for standing seam metal roofing systems.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {cstId && quotesStatus === "loading" && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" aria-busy="true">
            <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading saved quotes…</p>
          </div>
        )}
        {cstId && quotesStatus === "error" && (
          <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-red-600">{quotesError ?? "Could not load saved quotes."}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button type="button" onClick={() => setQuoteLoadId((id) => id + 1)}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={startNewEstimate}>
                Start a new estimate
              </Button>
            </div>
          </div>
        )}
        {chooserOpen && quotesStatus === "ready" && (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">Customer {cstId}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start a new estimate, or open a saved quote. A saved quote stays as it was until you change it and save again.
              </p>
            </div>
            <Button type="button" className="w-full gap-2" onClick={startNewEstimate}>
              <Plus className="size-4" />
              Start a new estimate
            </Button>
            <div className="flex flex-col gap-3">
              {savedQuotes.map((quote) => (
                <button
                  key={quote.id}
                  type="button"
                  onClick={() => openSavedQuote(quote)}
                  className="rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold text-foreground">{quote.roof_type_name}</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatQuoteMoney(quote.sale_price)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatQuoteSavedAt(quote.created_at)} · {formatCompactNumber(quote.squares)} squares
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {(!cstId || (quotesStatus === "ready" && !chooserOpen)) && sheetUsedFallback && sheetStatus === "ready" && (
          <Alert className="mb-6" variant="default">
            <AlertTitle>Using default pricing</AlertTitle>
            <AlertDescription>
              The Google Sheet could not be loaded or is not configured. Values shown use built-in defaults.
            </AlertDescription>
          </Alert>
        )}
        {(!cstId || (quotesStatus === "ready" && !chooserOpen)) && (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Layers className="size-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Select Roof Type</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {roofTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (type.id !== selectedRoofType) setFrozenQuote(null)
                      setSelectedRoofType(type.id)
                    }}
                    className={`group relative rounded-xl border-2 p-4 text-left transition-all hover:border-accent hover:shadow-md ${
                      selectedRoofType === type.id
                        ? "border-accent bg-accent/5 shadow-md"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{type.name}</span>
                        {selectedRoofType === type.id && (
                          <div className="size-2.5 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {type.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Ruler className="size-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Project Measurements</CardTitle>
                </div>
                <CardDescription>
                  Enter the measurements for the roofing project. All linear measurements should be in feet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    label="Squares"
                    id="squares"
                    value={formData.squares}
                    onChange={(v) => handleInputChange("squares", v)}
                  />
                  <FormField
                    label="Steep Pitch Squares"
                    id="steepPitchSquares"
                    value={formData.steepPitchSquares}
                    onChange={(v) => handleInputChange("steepPitchSquares", v)}
                  />
                  <FormField
                    label="Ridge Length"
                    id="ridgeLength"
                    value={formData.ridgeLength}
                    onChange={(v) => handleInputChange("ridgeLength", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Hip Length"
                    id="hipLength"
                    value={formData.hipLength}
                    onChange={(v) => handleInputChange("hipLength", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Eave Length"
                    id="eaveLength"
                    value={formData.eaveLength}
                    onChange={(v) => handleInputChange("eaveLength", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Rake Length"
                    id="rakeLength"
                    value={formData.rakeLength}
                    onChange={(v) => handleInputChange("rakeLength", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Valley Length"
                    id="valleyLength"
                    value={formData.valleyLength}
                    onChange={(v) => handleInputChange("valleyLength", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Wall Flashing"
                    id="wallFlashing"
                    value={formData.wallFlashing}
                    onChange={(v) => handleInputChange("wallFlashing", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Step Flashing"
                    id="stepFlashing"
                    value={formData.stepFlashing}
                    onChange={(v) => handleInputChange("stepFlashing", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Pitch Change"
                    id="pitchChange"
                    value={formData.pitchChange}
                    onChange={(v) => handleInputChange("pitchChange", v)}
                    suffix="ft"
                  />
                  <FormField
                    label={pipeLabelUpTo6}
                    id="pipeFlashingUpTo6"
                    value={formData.pipeFlashingUpTo6}
                    onChange={(v) => handleInputChange("pipeFlashingUpTo6", v)}
                  />
                  <FormField
                    label={pipeLabelUpTo13}
                    id="pipeFlashingUpTo13"
                    value={formData.pipeFlashingUpTo13}
                    onChange={(v) => handleInputChange("pipeFlashingUpTo13", v)}
                  />
                  <FormField
                    label={pipeLabelUpTo19}
                    id="pipeFlashingUpTo19"
                    value={formData.pipeFlashingUpTo19}
                    onChange={(v) => handleInputChange("pipeFlashingUpTo19", v)}
                  />
                  <FormField
                    label="Ventilation / Ridge Vent"
                    id="ventilation"
                    value={formData.ventilation}
                    onChange={(v) => handleInputChange("ventilation", v)}
                    suffix="ft"
                  />
                  <FormField
                    label="Snow Retention"
                    id="snowRetention"
                    value={formData.snowRetention}
                    onChange={(v) => handleInputChange("snowRetention", v)}
                    suffix="ft"
                  />
                  <div className="sm:col-span-2 mt-2">
                    <Separator className="mb-4" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Tear Off
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    <FormField
                      label="Layers"
                      id="layers"
                      value={formData.layers}
                      onChange={(v) => handleInputChange("layers", v)}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasCedarShake"
                        checked={hasCedarShake}
                        onCheckedChange={(checked) => {
                          setFrozenQuote(null)
                          const enabled = checked === true && formData.layers > 0
                          setHasCedarShake(enabled)
                          if (!enabled) {
                            setFormData((prev) => ({ ...prev, cedarShakeLayers: 0 }))
                          }
                        }}
                      />
                      <Label htmlFor="hasCedarShake" className="text-sm font-medium text-foreground">
                        Any Cedar Shake layers?
                      </Label>
                    </div>
                  </div>
                  {hasCedarShake ? (
                    <FormField
                      label="Cedar Shake Layers"
                      id="cedarShakeLayers"
                      value={formData.cedarShakeLayers}
                      onChange={(v) => handleInputChange("cedarShakeLayers", v)}
                    />
                  ) : (
                    <div />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={cn(
              "lg:sticky lg:top-8",
              summaryFillsViewport
                ? "lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col"
                : "lg:h-fit",
            )}
          >
            <Card
              className={cn(
                "border-2 shadow-lg md:overflow-hidden md:flex md:flex-col",
                summaryFillsViewport
                  ? "lg:h-full lg:min-h-0 lg:max-h-none"
                  : "md:max-h-[calc(100vh-11rem)]",
              )}
            >
              <CardHeader className="pb-4">
                {cstId && savedQuotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setChooserOpen(true)}
                    className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                    Saved quotes
                  </button>
                )}
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Estimate Summary</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {frozenQuote?.roof_type_name ?? roofTypes.find((t) => t.id === selectedRoofType)?.name ?? selectedRoofType}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-0 p-0 md:min-h-0 md:flex-1">
                <div className="flex flex-col gap-6 px-6 pb-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
                  {admin && (
                    <>
                      <BreakdownSection calculations={summaryCalculations} breakdown={summaryBreakdown} />

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Material Subtotal</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(summaryCalculations.materialSubtotal)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Fees & Adjustments
                  </h3>
                  <FeeRow label="Sub Labor" value={summaryCalculations.subLabor}>
                    <FeeDetail label={`Panels (${formatCompactNumber(formData.squares)} sq × ${formatCurrency(summaryFees.subLaborPerSquare)})`} value={summaryCalculations.subLaborPanels} />
                    <FeeDetail label={`Ridge (${formatCompactNumber(formData.ridgeLength)} ft × ${formatCurrency(summaryFees.subLaborPerRidgeFt)})`} value={summaryCalculations.subLaborRidge} />
                  </FeeRow>
                  <FeeRow
                    label={`Dumpster Fee${summaryCalculations.dumpsterSquaresForTier > 0 ? ` (${formatCompactNumber(summaryCalculations.dumpsterSquaresForTier)} sq)` : ""}`}
                    value={summaryCalculations.dumpsterFee}
                  >
                    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                      <span className="text-muted-foreground/80 truncate min-w-0">Base Squares</span>
                      <span className="text-muted-foreground/80 font-medium shrink-0 tabular-nums">
                        {formatCompactNumber(formData.squares)} sq
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                      <span className="text-muted-foreground/80 truncate min-w-0">Layers</span>
                      <span className="text-muted-foreground/80 font-medium shrink-0 tabular-nums">
                        {formatCompactNumber(formData.layers)}
                      </span>
                    </div>
                    {hasCedarShake && (
                      <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                        <span className="text-muted-foreground/80 truncate min-w-0">Cedar Shake Weight</span>
                        <span className="text-muted-foreground/80 font-medium shrink-0 tabular-nums">
                          +{formatCompactNumber(formData.cedarShakeLayers)} × 0.5 = +{formatCompactNumber(formData.cedarShakeLayers * 0.5)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
                      <span className="text-muted-foreground/80 truncate min-w-0">Weighted Squares</span>
                      <span className="text-muted-foreground/80 font-medium shrink-0 tabular-nums">
                        {formatCompactNumber(formData.squares)} × {formatCompactNumber(summaryCalculations.weightedLayers)} = {formatCompactNumber(summaryCalculations.dumpsterSquaresForTier)} sq
                      </span>
                    </div>
                    <FeeDetail label="Applied Dumpster Tier" value={summaryCalculations.dumpsterFee} />
                  </FeeRow>
                  <FeeRow label="Satellite" value={summaryFees.satellite} />
                  <FeeRow label="Permits" value={summaryFees.permits} />
                  <FeeRow label={`Financing (${formatCompactNumber(summaryFees.financingPct)}%)`} value={summaryCalculations.financing} />
                  <FeeRow label={`Sales Tax (${formatCompactNumber(summaryFees.salesTaxPct)}%)`} value={summaryCalculations.salesTax} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Fees & Adjustments</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(summaryCalculations.totalHardCosts)}
                  </span>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="profitMargin" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Goal Profit Margin
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="profitMarginInput"
                        type="number"
                        min={0}
                          max={marginMax}
                        step={1}
                        value={profitMarginPct}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0 && v <= marginMax) {
                              if (v !== profitMarginPct) setFrozenQuote(null)
                              setProfitMarginPct(v)
                            }
                        }}
                        className="w-20 h-8 text-right text-sm tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    id="profitMargin"
                    min={0}
                      max={marginMax}
                    step={1}
                    value={[profitMarginPct]}
                    onValueChange={([v]) => {
                      if (v !== profitMarginPct) setFrozenQuote(null)
                      setProfitMarginPct(v)
                    }}
                    className="w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Commission ({formatCompactNumber(summaryFees.commissionPct)}%)
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatCurrency(summaryCalculations.commission)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expected Profit</span>
                    <span className={`text-sm font-semibold tabular-nums ${summaryCalculations.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {formatCurrency(summaryCalculations.profit)}
                    </span>
                  </div>
                </div>

                  {summaryCalculations.invalidMarginTarget && (
                    <p className="text-xs text-amber-600">
                      Goal Profit Margin + Commission + Financing must be below 100%. Lower the margin target to see a valid sale price.
                    </p>
                  )}

                <Separator />

                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Pricing and fees update dynamically from the connected spreadsheet. Final quote may vary based on site conditions.
                  </p>
                  </>
                )}

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      className="w-full gap-2"
                      disabled={!cstId || savingQuote || sheetStatus !== "ready" || frozenQuote !== null}
                      title={
                        !cstId
                          ? "Open this page with a cst_id from SalesPro to save."
                          : frozenQuote
                            ? "Change the estimate to save it as a new quote."
                            : undefined
                      }
                      onClick={handleSaveQuote}
                    >
                      {savingQuote ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      {savingQuote ? "Saving…" : "Save quote"}
                    </Button>
                    {!cstId && (
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Open this page with a cst_id from SalesPro to save.
                      </p>
                    )}
                    {saveMessage && (
                      <p
                        className={cn(
                          "text-xs text-center leading-relaxed",
                          saveMessage.tone === "error" ? "text-red-600" : "text-muted-foreground",
                        )}
                      >
                        {saveMessage.text}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={summaryCalculations.invalidMarginTarget}
                      title={
                        summaryCalculations.invalidMarginTarget
                          ? "Lower goal profit margin so sale price is valid before exporting."
                          : undefined
                      }
                      onClick={handleExportPdf}
                    >
                      <Download className="size-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="w-full gap-2">
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="mt-auto border-t bg-card px-6 py-4">
                  <div className="rounded-xl bg-primary p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary-foreground">Sale Price</span>
                      <span className="text-2xl font-bold text-primary-foreground">
                        {formatCurrency(summaryCalculations.salePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </main>
    </div>
  )
}

function FeeRow({
  label,
  value,
  children,
}: {
  label: string
  value: number
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = !!children

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-sm transition-colors ${
          hasChildren ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
        } ${expanded ? "bg-muted/50" : ""}`}
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {hasChildren ? (
            <ChevronRight
              className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {label}
        </span>
        <span className={`tabular-nums ${value > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)}
        </span>
      </button>
      {expanded && hasChildren && (
        <div className="ml-6.5 mt-0.5 mb-1 flex flex-col gap-px border-l-2 border-muted pl-3">
          {children}
        </div>
      )}
    </div>
  )
}

function FeeDetail({ label, value, title }: { label: string; value: number; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <span className="text-muted-foreground/80 truncate min-w-0" title={title}>
        {label}
      </span>
      <span className="text-muted-foreground/80 font-medium shrink-0 tabular-nums">
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)}
      </span>
    </div>
  )
}

function BreakdownSection({
  calculations,
  breakdown,
}: {
  calculations: Record<string, number | boolean>
  breakdown: PricingBreakdown
}) {
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    const nextState = !allExpanded
    setAllExpanded(nextState)
    if (nextState) {
      const allKeys = rows.map((r) => r.key).filter((k) => {
        const items = breakdown[k as keyof PricingBreakdown]
        return items && items.length > 0
      })
      setExpandedKeys(new Set(allKeys))
    } else {
      setExpandedKeys(new Set())
    }
  }, [allExpanded, breakdown])

  const rows: { key: string; label: string; calcKey: string; quantityKey: string }[] = [
    { key: "squareRate", label: "Squares", calcKey: "squares", quantityKey: "squaresQty" },
    { key: "ridgeRate", label: "Ridge", calcKey: "ridge", quantityKey: "ridgeQty" },
    { key: "hipRate", label: "Hip", calcKey: "hip", quantityKey: "hipQty" },
    { key: "eaveRate", label: "Eaves", calcKey: "eave", quantityKey: "eaveQty" },
    { key: "rakeRate", label: "Rakes", calcKey: "rake", quantityKey: "rakeQty" },
    { key: "valleyRate", label: "Valleys", calcKey: "valleys", quantityKey: "valleysQty" },
    { key: "wallFlashingRate", label: "Wall Flashing", calcKey: "wallFlashing", quantityKey: "wallFlashingQty" },
    { key: "stepFlashingRate", label: "Step Flashing", calcKey: "stepFlashing", quantityKey: "stepFlashingQty" },
    { key: "pitchChangeRate", label: "Pitch Changes", calcKey: "pitchChange", quantityKey: "pitchChangeQty" },
    { key: "pipeFlashingRate", label: "Pipe Flashing", calcKey: "pipeFlashing", quantityKey: "pipeFlashingQty" },
    { key: "ventilationRate", label: "Ventilation", calcKey: "ventilation", quantityKey: "ventilationQty" },
    { key: "snowRetentionRate", label: "Snow Retention", calcKey: "snowRetention", quantityKey: "snowRetentionQty" },
    { key: "miscFixedCost", label: "Misc Materials", calcKey: "miscFixedCost", quantityKey: "miscFixedCostQty" },
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Materials
        </h3>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <ExpandableSummaryRow
            key={row.key}
            rateKey={row.key}
            label={row.label}
            value={Number(calculations[row.calcKey] ?? 0)}
            quantity={Number(calculations[row.quantityKey] ?? 0)}
            items={breakdown[row.key as keyof PricingBreakdown]}
            pipeFlashingQtyUpTo6={Number(calculations.pipeFlashingQtyUpTo6 ?? 0)}
            pipeFlashingQtyUpTo13={Number(calculations.pipeFlashingQtyUpTo13 ?? 0)}
            pipeFlashingQtyUpTo19={Number(calculations.pipeFlashingQtyUpTo19 ?? 0)}
            steepPitchSquaresQty={Number(calculations.steepPitchSquaresQty ?? 0)}
            steepPitchAdder={Number(calculations.steepPitchAdder ?? 0)}
            roofSquares={Number(calculations.squaresQty ?? 0)}
            expanded={expandedKeys.has(row.key)}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}

function ExpandableSummaryRow({
  rateKey,
  label,
  value,
  quantity,
  items,
  pipeFlashingQtyUpTo6,
  pipeFlashingQtyUpTo13,
  pipeFlashingQtyUpTo19,
  steepPitchSquaresQty,
  steepPitchAdder,
  roofSquares,
  expanded,
  onToggle,
}: {
  rateKey: string
  label: string
  value: number
  quantity: number
  items?: LineItemDetail[]
  pipeFlashingQtyUpTo6?: number
  pipeFlashingQtyUpTo13?: number
  pipeFlashingQtyUpTo19?: number
  steepPitchSquaresQty?: number
  steepPitchAdder?: number
  /** Roofing squares (for Misc per-sq line items) */
  roofSquares?: number
  expanded: boolean
  onToggle: (key: string) => void
}) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(v)

  const detailRows: { name: string; unit: number; qty: number; total?: number; title?: string }[] =
    (items ?? []).map((item) => {
      const name = item.name.toLowerCase()
      const customPipeQty =
        rateKey === "pipeFlashingRate"
          ? (name.includes("up to 19")
            ? (pipeFlashingQtyUpTo19 ?? 0)
            : name.includes("up to 13")
              ? (pipeFlashingQtyUpTo13 ?? 0)
              : name.includes("up to 6")
                ? (pipeFlashingQtyUpTo6 ?? 0)
                : 0)
          : null
      const miscEffectiveQty =
        rateKey === "miscFixedCost"
          ? (item.miscUnit === "perSq" ? (roofSquares ?? 0) : 1)
          : null
      const rawUnits =
        customPipeQty ??
        (miscEffectiveQty !== null ? item.multiplier * miscEffectiveQty : item.multiplier * quantity)
      const billableUnits = customPipeQty ?? (item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits)
      const total = item.costPerUnit * billableUnits
      const roundedNote = customPipeQty === null && item.multiplier < 1
        ? ` (rounded from ${formatCompactNumber(rawUnits)} to ${formatCompactNumber(billableUnits)})`
        : ""

      return {
        name: item.name,
        unit: item.costPerUnit,
        qty: billableUnits,
        total,
        title: `${item.name}: ${formatCurrency(item.costPerUnit)} x ${formatCompactNumber(billableUnits)} = ${formatCurrency(total)}${roundedNote}`,
      }
    })

  if (rateKey === "squareRate" && (steepPitchSquaresQty ?? 0) > 0 && (steepPitchAdder ?? 0) > 0) {
    const steepQty = steepPitchSquaresQty ?? 0
    const steepUnitAdder = (steepPitchAdder ?? 0) / steepQty
    const baseSquareRate = steepUnitAdder / 0.1
    detailRows.push({
      name: "Steep Pitch Adder (10%)",
      unit: steepUnitAdder,
      qty: steepQty,
      title: `Steep pitch adder: 10% of ${formatCurrency(baseSquareRate)} per sq = ${formatCurrency(steepUnitAdder)} per steep sq`,
    })
  }

  const hasItems = detailRows.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => hasItems && onToggle(rateKey)}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
          hasItems ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
        } ${expanded ? "bg-muted/50" : ""}`}
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {hasItems ? (
            <ChevronRight
              className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {label}
        </span>
        <span className={`tabular-nums ${value > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
          {formatCurrency(value)}
        </span>
      </button>

      {expanded && hasItems && (
        <div className="ml-6.5 mt-0.5 mb-1 flex flex-col gap-px border-l-2 border-muted pl-3">
          {detailRows.map((item, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 py-0.5 text-xs"
            >
              <span className="text-muted-foreground/80 truncate min-w-0" title={item.title}>
                {item.name}
              </span>
              <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                {formatCurrency(item.unit)} &times; {formatCompactNumber(item.qty)}
                <span className="text-muted-foreground/80 font-medium ml-1">
                  = {formatCurrency(item.total ?? (item.unit * item.qty))}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatCompactNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  const s = n.toPrecision(4)
  return parseFloat(s).toString()
}

function FormField({
  label,
  id,
  value,
  onChange,
  prefix,
  suffix,
  helper,
}: {
  label: string
  id: string
  value: number
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  helper?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          min={0}
          step="any"
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""} bg-card`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}
