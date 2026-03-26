import { getSheetData } from "@/lib/google-sheets"
import RoofingCalculator from "@/components/roofing-calculator"

export default async function Page() {
  const { pricing, fees } = await getSheetData()

  return <RoofingCalculator pricingByType={pricing} feeConfig={fees} />
}
