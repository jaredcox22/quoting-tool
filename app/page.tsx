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
  ArrowUpRight,
} from "lucide-react"

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
    priceMultiplier: 1.0,
  },
  {
    id: "1-slr-panel" as const,
    name: '1" SLR Panel',
    description: "Standing Lock Rib panel with superior weather resistance",
    priceMultiplier: 1.15,
  },
  {
    id: "ultra-2000" as const,
    name: "Ultra 2000 Exposed",
    description: "Cost-effective exposed fastener system with durability",
    priceMultiplier: 0.85,
  },
]

// Mock pricing per unit (would connect to Google Sheets/API in production)
const basePricing = {
  squareRate: 850,
  ridgeHipRate: 18,
  eaveRakeRate: 12,
  valleyRate: 22,
  wallFlashingRate: 15,
  stepFlashingRate: 14,
  pitchChangeRate: 75,
  pipeFlashingRate: 65,
  ventilationRate: 28,
  snowRetentionRate: 32,
}

export default function RoofingCalculator() {
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

  const calculations = useMemo(() => {
    const roofType = roofTypes.find((t) => t.id === selectedRoofType)
    const multiplier = roofType?.priceMultiplier || 1

    const squares = formData.squares * basePricing.squareRate * multiplier
    const ridgeHip = (formData.ridgeLength + formData.hipLength) * basePricing.ridgeHipRate * multiplier
    const eaveRakes = (formData.eaveLength + formData.rakeLength) * basePricing.eaveRakeRate * multiplier
    const valleys = formData.valleyLength * basePricing.valleyRate * multiplier
    const wallFlashing = formData.wallFlashing * basePricing.wallFlashingRate * multiplier
    const stepFlashing = formData.stepFlashing * basePricing.stepFlashingRate * multiplier
    const pitchChange = formData.pitchChange * basePricing.pitchChangeRate * multiplier
    const pipeFlashing = formData.pipeFlashing * basePricing.pipeFlashingRate * multiplier
    const ventilation = formData.ventilation * basePricing.ventilationRate * multiplier
    const snowRetention = formData.snowRetention * basePricing.snowRetentionRate * multiplier

    const materialSubtotal =
      squares + ridgeHip + eaveRakes + valleys + wallFlashing + stepFlashing + pitchChange + pipeFlashing + ventilation + snowRetention

    const fees =
      formData.dumpsterFee +
      formData.permits +
      formData.satellite +
      materialSubtotal * (formData.commission / 100) +
      materialSubtotal * (formData.financing / 100)

    return {
      squares,
      ridgeHip,
      eaveRakes,
      valleys,
      wallFlashing,
      stepFlashing,
      pitchChange,
      pipeFlashing,
      ventilation,
      snowRetention,
      materialSubtotal,
      fees,
      total: materialSubtotal + fees,
    }
  }, [formData, selectedRoofType])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left Column - Calculator Form */}
          <div className="flex flex-col gap-8">
            {/* Roof Type Selection */}
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

            {/* Project Measurements */}
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

            {/* Additional Fees */}
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

            {/* Action Buttons - Mobile */}
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

          {/* Right Column - Summary Panel */}
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
                {/* Pricing Breakdown */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Pricing Breakdown
                  </h3>
                  <div className="flex flex-col gap-2">
                    <SummaryRow label="Squares" value={calculations.squares} />
                    <SummaryRow label="Ridge / Hip" value={calculations.ridgeHip} />
                    <SummaryRow label="Eaves / Rakes" value={calculations.eaveRakes} />
                    <SummaryRow label="Valleys" value={calculations.valleys} />
                    <SummaryRow label="Wall Flashing" value={calculations.wallFlashing} />
                    <SummaryRow label="Step Flashing" value={calculations.stepFlashing} />
                    <SummaryRow label="Pitch Changes" value={calculations.pitchChange} />
                    <SummaryRow label="Pipe Flashing" value={calculations.pipeFlashing} />
                    <SummaryRow label="Ventilation" value={calculations.ventilation} />
                    <SummaryRow label="Snow Retention" value={calculations.snowRetention} />
                  </div>
                </div>

                <Separator />

                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Subtotal</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(calculations.materialSubtotal)}
                  </span>
                </div>

                {/* Fees */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Fees & Adjustments</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(calculations.fees)}
                  </span>
                </div>

                <Separator />

                {/* Total */}
                <div className="rounded-xl bg-primary p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-foreground">Estimated Total</span>
                    <span className="text-2xl font-bold text-primary-foreground">
                      {formatCurrency(calculations.total)}
                    </span>
                  </div>
                </div>

                {/* Note */}
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Pricing updates dynamically based on selected roof type and entered values. Final quote may vary based on site conditions.
                </p>

                {/* Action Buttons - Desktop */}
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

// Form Field Component
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

// Summary Row Component
function SummaryRow({ label, value }: { label: string; value: number }) {
  const formatCurrency = (v: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(v)
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={value > 0 ? "text-foreground" : "text-muted-foreground/50"}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}
