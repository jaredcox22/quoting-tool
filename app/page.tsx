import RoofingCalculator from "@/components/roofing-calculator"
import { Suspense } from "react"

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RoofingCalculator />
    </Suspense>
  )
}
