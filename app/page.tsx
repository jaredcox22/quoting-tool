import { getPricing } from "@/lib/google-sheets"
import RoofingCalculator from "@/components/roofing-calculator"

export default async function Page() {
  const pricingByType = await getPricing()

  return <RoofingCalculator pricingByType={pricingByType} />
}
