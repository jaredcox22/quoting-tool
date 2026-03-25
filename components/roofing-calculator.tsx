"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Ruler,
  Calculator,
  DollarSign,
  RotateCcw,
  Save,
  Layers,
  CircleDot,
  ChevronRight,
} from "lucide-react"
import type { RoofTypePricing, PricingData, PricingBreakdown, LineItemDetail } from "@/lib/google-sheets"
import { defaultPricing } from "@/lib/google-sheets"

type RoofType = "vertical-seam" | "1-slr-panel" | "ultra-2000"

interface FormData {
  squares: number
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
  dumpsterFee: number
  commission: number
  financing: number
  satellite: number
  permits: number
}

const initialFormData: FormData = {
  squares: 0,
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
  dumpsterFee: 0,
  commission: 0,
  financing: 0,
  satellite: 0,
  permits: 0,
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
}

export default function RoofingCalculator({ pricingByType }: RoofingCalculatorProps) {
  const [selectedRoofType, setSelectedRoofType] = useState<RoofType>("vertical-seam")
  const [formData, setFormData] = useState<FormData>(initialFormData)

  const handleInputChange = (field: keyof FormData, value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value)
    setFormData((prev) => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }))
  }

  const handleReset = () => {
    setFormData(initialFormData)
    setSelectedRoofType("vertical-seam")
  }

  const entry = pricingByType?.[selectedRoofType]
    ?? pricingByType?.["vertical-seam"]
    ?? { rates: defaultPricing, breakdown: {} }

  const pricing: PricingData = entry.rates ?? defaultPricing
  const breakdown: PricingBreakdown = entry.breakdown ?? {}

  const calculations = useMemo(() => {
    const squares = formData.squares * pricing.squareRate
    const ridge = formData.ridgeLength * pricing.ridgeRate
    const hip = formData.hipLength * pricing.hipRate
    const eave = formData.eaveLength * pricing.eaveRate
    const rake = formData.rakeLength * pricing.rakeRate
    const valleys = formData.valleyLength * pricing.valleyRate
    const wallFlashing = formData.wallFlashing * pricing.wallFlashingRate
    const stepFlashing = formData.stepFlashing * pricing.stepFlashingRate
    const pitchChange = formData.pitchChange * pricing.pitchChangeRate
    const pipeFlashing = formData.pipeFlashing * pricing.pipeFlashingRate
    const ventilation = formData.ventilation * pricing.ventilationRate
    const snowRetention = formData.snowRetention * pricing.snowRetentionRate

    const materialSubtotal =
      squares + ridge + hip + eave + rake + valleys +
      wallFlashing + stepFlashing + pitchChange + pipeFlashing +
      ventilation + snowRetention + pricing.miscFixedCost

    const fees =
      formData.dumpsterFee +
      formData.permits +
      formData.satellite +
      materialSubtotal * (formData.commission / 100) +
      materialSubtotal * (formData.financing / 100)

    return {
      squares,
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
      miscFixedCost: pricing.miscFixedCost,
      materialSubtotal,
      fees,
      total: materialSubtotal + fees,
    }
  }, [formData, pricing])

  const formatCurrency = (value: number) => {
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
                  Standing Seam Metal Roofing Calculator
                </h1>
                <Badge className="bg-accent text-accent-foreground border-0 hidden sm:flex">
                  <CircleDot className="size-3 animate-pulse" />
                  Live Estimate
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base text-pretty max-w-2xl">
                Generate a fast, professional estimate for standing seam metal roofing systems.
              </p>
            </div>
            <Badge className="bg-accent text-accent-foreground border-0 sm:hidden w-fit">
              <CircleDot className="size-3 animate-pulse" />
              Live Estimate
            </Badge>
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
                    helper="Total roof area (1 square = 100 sq ft)"
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="size-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Additional Fees & Adjustments</CardTitle>
                </div>
                <CardDescription>
                  Include any additional project costs or percentage-based adjustments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    label="Dumpster Fee"
                    id="dumpsterFee"
                    value={formData.dumpsterFee}
                    onChange={(v) => handleInputChange("dumpsterFee", v)}
                    prefix="$"
                  />
                  <FormField
                    label="Commission"
                    id="commission"
                    value={formData.commission}
                    onChange={(v) => handleInputChange("commission", v)}
                    suffix="%"
                    helper="Percentage of material cost"
                  />
                  <FormField
                    label="Financing"
                    id="financing"
                    value={formData.financing}
                    onChange={(v) => handleInputChange("financing", v)}
                    suffix="%"
                    helper="Financing fee percentage"
                  />
                  <FormField
                    label="Satellite"
                    id="satellite"
                    value={formData.satellite}
                    onChange={(v) => handleInputChange("satellite", v)}
                    prefix="$"
                  />
                  <FormField
                    label="Permits"
                    id="permits"
                    value={formData.permits}
                    onChange={(v) => handleInputChange("permits", v)}
                    prefix="$"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row lg:hidden">
              <Button size="lg" className="flex-1 gap-2 bg-primary hover:bg-primary/90">
                <Calculator className="size-4" />
                Calculate Estimate
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset} className="gap-2">
                <RotateCcw className="size-4" />
                Reset
              </Button>
              <Button variant="secondary" size="lg" className="gap-2">
                <Save className="size-4" />
                Save Quote
              </Button>
            </div>
          </div>

          <div className="lg:sticky lg:top-8 lg:h-fit">
            <Card className="border-2 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Estimate Summary</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {roofTypes.find((t) => t.id === selectedRoofType)?.name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Pricing Breakdown
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    <ExpandableSummaryRow label="Squares" value={calculations.squares} items={breakdown.squareRate} />
                    <ExpandableSummaryRow label="Ridge" value={calculations.ridge} items={breakdown.ridgeRate} />
                    <ExpandableSummaryRow label="Hip" value={calculations.hip} items={breakdown.hipRate} />
                    <ExpandableSummaryRow label="Eaves" value={calculations.eave} items={breakdown.eaveRate} />
                    <ExpandableSummaryRow label="Rakes" value={calculations.rake} items={breakdown.rakeRate} />
                    <ExpandableSummaryRow label="Valleys" value={calculations.valleys} items={breakdown.valleyRate} />
                    <ExpandableSummaryRow label="Wall Flashing" value={calculations.wallFlashing} items={breakdown.wallFlashingRate} />
                    <ExpandableSummaryRow label="Step Flashing" value={calculations.stepFlashing} items={breakdown.stepFlashingRate} />
                    <ExpandableSummaryRow label="Pitch Changes" value={calculations.pitchChange} items={breakdown.pitchChangeRate} />
                    <ExpandableSummaryRow label="Pipe Flashing" value={calculations.pipeFlashing} items={breakdown.pipeFlashingRate} />
                    <ExpandableSummaryRow label="Ventilation" value={calculations.ventilation} items={breakdown.ventilationRate} />
                    <ExpandableSummaryRow label="Snow Retention" value={calculations.snowRetention} items={breakdown.snowRetentionRate} />
                    <ExpandableSummaryRow label="Misc Materials" value={calculations.miscFixedCost} items={breakdown.miscFixedCost} />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Subtotal</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(calculations.materialSubtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Fees & Adjustments</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(calculations.fees)}
                  </span>
                </div>

                <Separator />

                <div className="rounded-xl bg-primary p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-foreground">Estimated Total</span>
                    <span className="text-2xl font-bold text-primary-foreground">
                      {formatCurrency(calculations.total)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Pricing updates dynamically based on selected roof type and entered values. Final quote may vary based on site conditions.
                </p>

                <div className="hidden flex-col gap-3 lg:flex">
                  <Button size="lg" className="w-full gap-2 bg-primary hover:bg-primary/90">
                    <Calculator className="size-4" />
                    Calculate Estimate
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                      <RotateCcw className="size-4" />
                      Reset
                    </Button>
                    <Button variant="secondary" className="gap-2">
                      <Save className="size-4" />
                      Save Quote
                    </Button>
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

function ExpandableSummaryRow({
  label,
  value,
  items,
}: {
  label: string
  value: number
  items?: LineItemDetail[]
}) {
  const [expanded, setExpanded] = useState(false)
  const hasItems = items && items.length > 0

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(v)

  return (
    <div>
      <button
        type="button"
        onClick={() => hasItems && setExpanded(!expanded)}
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
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 py-0.5 text-xs"
            >
              <span className="text-muted-foreground/80 truncate min-w-0">
                {item.name}
              </span>
              <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                {formatCompactNumber(item.multiplier)} &times; {formatCurrency(item.costPerUnit)}
                <span className="text-muted-foreground/80 font-medium ml-1">
                  = {formatCurrency(item.total)}
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
