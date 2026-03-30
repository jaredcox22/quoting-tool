"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
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
  ChevronRight,
} from "lucide-react"
import type { RoofTypePricing, PricingData, PricingBreakdown, LineItemDetail, FeeConfig } from "@/lib/google-sheets"
import { defaultPricing, defaultFeeConfig } from "@/lib/google-sheets"

type RoofType = "vertical-seam" | "1-slr-panel" | "ultra-2000"

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
  pipeFlashing: number
  ventilation: number
  snowRetention: number
}

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
  pipeFlashing: 0,
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

interface RoofingCalculatorProps {
  pricingByType: RoofTypePricing
  feeConfig: FeeConfig
}

export default function RoofingCalculator({ pricingByType, feeConfig }: RoofingCalculatorProps) {
  const [selectedRoofType, setSelectedRoofType] = useState<RoofType>("vertical-seam")
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [hasCedarShake, setHasCedarShake] = useState(false)

  const fees = feeConfig ?? defaultFeeConfig
  const maxGoalProfitMargin = Math.max(0, Math.floor(99 - fees.commissionPct))
  const [profitMarginPct, setProfitMarginPct] = useState(
    Math.min(fees.goalProfitMarginPct, maxGoalProfitMargin)
  )

  useEffect(() => {
    setProfitMarginPct((prev) => Math.min(prev, maxGoalProfitMargin))
  }, [maxGoalProfitMargin])

  useEffect(() => {
    if (formData.layers <= 0 && hasCedarShake) {
      setHasCedarShake(false)
      setFormData((prev) => ({ ...prev, cedarShakeLayers: 0 }))
    }
  }, [formData.layers, hasCedarShake])

  const handleInputChange = (field: keyof FormData, value: string) => {
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

  const handleReset = () => {
    setFormData(initialFormData)
    setHasCedarShake(false)
    setSelectedRoofType("vertical-seam")
    setProfitMarginPct(Math.min(fees.goalProfitMarginPct, maxGoalProfitMargin))
  }

  const entry = pricingByType?.[selectedRoofType]
    ?? pricingByType?.["vertical-seam"]
    ?? { rates: defaultPricing, breakdown: {} }

  const pricing: PricingData = entry.rates ?? defaultPricing
  const breakdown: PricingBreakdown = entry.breakdown ?? {}

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

    const computeLineTotal = (rateKey: keyof PricingData, quantity: number) => {
      const items = breakdown[rateKey]
      if (!items || items.length === 0) {
        return quantity * pricing[rateKey]
      }

      return items.reduce((sum, item) => {
        if (quantity <= 0) return sum
        const rawUnits = item.multiplier * quantity
        const billableUnits = item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits
        return sum + billableUnits * item.costPerUnit
      }, 0)
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
    const pipeFlashing = computeLineTotal("pipeFlashingRate", formData.pipeFlashing)
    const ventilation = computeLineTotal("ventilationRate", ventilationLength)
    const snowRetention = computeLineTotal("snowRetentionRate", snowRetentionLength)
    const miscFixedCost = computeLineTotal("miscFixedCost", 1)

    const materialSubtotal =
      squares + ridge + hip + eave + rake + valleys +
      wallFlashing + stepFlashing + pitchChange + pipeFlashing +
      ventilation + snowRetention + miscFixedCost

    const subLaborPanels = formData.squares * fees.subLaborPerSquare
    const subLaborRidge = ridgeLength * fees.subLaborPerRidgeFt
    const subLabor = subLaborPanels + subLaborRidge

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
      pipeFlashingQty: formData.pipeFlashing,
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
  }, [formData, pricing, fees, profitMarginPct])

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
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
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Layers className="size-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Select Roof Type</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {roofTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedRoofType(type.id)}
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
                    helper="Squares with pitch 8/12 or greater (adds 10%)"
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
                    helper="Number of pitch transitions"
                  />
                  <FormField
                    label="Pipe Flashing Qty"
                    id="pipeFlashing"
                    value={formData.pipeFlashing}
                    onChange={(v) => handleInputChange("pipeFlashing", v)}
                    helper="Number of pipe boots needed"
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

          <div className="lg:sticky lg:top-8 lg:h-fit">
            <Card className="border-2 shadow-lg md:max-h-[calc(100vh-11rem)] md:overflow-hidden md:flex md:flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Estimate Summary</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {roofTypes.find((t) => t.id === selectedRoofType)?.name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-0 p-0 md:min-h-0 md:flex-1">
                <div className="flex flex-col gap-6 px-6 pb-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
                  <BreakdownSection calculations={calculations} breakdown={breakdown} />

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Material Subtotal</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(calculations.materialSubtotal)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Fees & Adjustments
                  </h3>
                  <FeeRow label="Sub Labor" value={calculations.subLabor}>
                    <FeeDetail label={`Panels (${formatCompactNumber(formData.squares)} sq × ${formatCurrency(fees.subLaborPerSquare)})`} value={calculations.subLaborPanels} />
                    <FeeDetail label={`Ridge (${formatCompactNumber(formData.ridgeLength)} ft × ${formatCurrency(fees.subLaborPerRidgeFt)})`} value={calculations.subLaborRidge} />
                  </FeeRow>
                  <FeeRow
                    label={`Dumpster Fee${calculations.dumpsterSquaresForTier > 0 ? ` (${formatCompactNumber(calculations.dumpsterSquaresForTier)} sq)` : ""}`}
                    value={calculations.dumpsterFee}
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
                        {formatCompactNumber(formData.squares)} × {formatCompactNumber(calculations.weightedLayers)} = {formatCompactNumber(calculations.dumpsterSquaresForTier)} sq
                      </span>
                    </div>
                    <FeeDetail label="Applied Dumpster Tier" value={calculations.dumpsterFee} />
                  </FeeRow>
                  <FeeRow label="Satellite" value={fees.satellite} />
                  <FeeRow label="Permits" value={fees.permits} />
                  <FeeRow label={`Financing (${formatCompactNumber(fees.financingPct)}%)`} value={calculations.financing} />
                  <FeeRow label={`Sales Tax (${formatCompactNumber(fees.salesTaxPct)}%)`} value={calculations.salesTax} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Fees & Adjustments</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(calculations.totalHardCosts)}
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
                          max={maxGoalProfitMargin}
                        step={1}
                        value={profitMarginPct}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0 && v <= maxGoalProfitMargin) setProfitMarginPct(v)
                        }}
                        className="w-20 h-8 text-right text-sm tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    id="profitMargin"
                    min={0}
                      max={maxGoalProfitMargin}
                    step={1}
                    value={[profitMarginPct]}
                    onValueChange={([v]) => setProfitMarginPct(v)}
                    className="w-full"
                  />
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Commission ({formatCompactNumber(fees.commissionPct)}%)
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatCurrency(calculations.commission)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expected Profit</span>
                    <span className={`text-sm font-semibold tabular-nums ${calculations.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {formatCurrency(calculations.profit)}
                    </span>
                  </div>
                </div>

                  {calculations.invalidMarginTarget && (
                    <p className="text-xs text-amber-600">
                      Goal Profit Margin + Commission + Financing must be below 100%. Lower the margin target to see a valid sale price.
                    </p>
                  )}

                <Separator />

                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Pricing and fees update dynamically from the connected spreadsheet. Final quote may vary based on site conditions.
                  </p>

                  <Button variant="outline" onClick={handleReset} className="w-full gap-2">
                    <RotateCcw className="size-4" />
                    Reset
                  </Button>
                </div>

                <div className="mt-auto border-t bg-card px-6 py-4">
                  <div className="rounded-xl bg-primary p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary-foreground">Sale Price</span>
                      <span className="text-2xl font-bold text-primary-foreground">
                        {formatCurrency(calculations.salePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
            steepPitchSquaresQty={Number(calculations.steepPitchSquaresQty ?? 0)}
            steepPitchAdder={Number(calculations.steepPitchAdder ?? 0)}
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
  steepPitchSquaresQty,
  steepPitchAdder,
  expanded,
  onToggle,
}: {
  rateKey: string
  label: string
  value: number
  quantity: number
  items?: LineItemDetail[]
  steepPitchSquaresQty?: number
  steepPitchAdder?: number
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
      const rawUnits = item.multiplier * quantity
      const billableUnits = item.multiplier < 1 ? Math.ceil(rawUnits) : rawUnits
      const total = item.costPerUnit * billableUnits
      const roundedNote = item.multiplier < 1
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
