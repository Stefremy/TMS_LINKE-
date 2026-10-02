import { getBillingConfigAction, getMoloniDetailsAction } from "@/app/actions/billing-config"
import { BillingConfigClient } from "./components/BillingConfigClient"

export const dynamic = "force-dynamic"

export default async function FaturacaoConfigPage() {
  const [billingConfig, moloniDetails] = await Promise.all([
    getBillingConfigAction(),
    getMoloniDetailsAction(),
  ])

  return (
    <BillingConfigClient 
      initialConfig={billingConfig} 
      moloniDetails={moloniDetails} 
    />
  )
}
