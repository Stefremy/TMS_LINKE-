import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getClientesAction } from "@/app/actions/clientes"
import { getCustomInvoicesAction, getMoloniConfigAction } from "@/app/actions/moloni"
import FaturaPersonalizadaClient from "../personalizada/FaturaPersonalizadaClient"
import { getBillingConfigAction } from "@/app/actions/billing-config"

export const dynamic = "force-dynamic"

export default async function ClientesFaturacaoPage() {
  await requireOpsPageAccess("/ops/faturacao/clientes")

  const [clients, initialInvoices, moloniConfig, billingConfig] = await Promise.all([
    getClientesAction(),
    getCustomInvoicesAction(),
    getMoloniConfigAction(),
    getBillingConfigAction(),
  ])

  return (
    <FaturaPersonalizadaClient
      clients={clients.map(c => ({ ...c, pricing: undefined }))}
      initialInvoices={initialInvoices}
      moloniConfig={moloniConfig}
      defaultPaymentDays={billingConfig.defaultPaymentDays ?? 30}
    />
  )
}
