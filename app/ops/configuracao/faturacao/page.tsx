import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { billingViewSelection } from "@/lib/billing/view-filters"
import { BillingViewFilters } from "./components/BillingViewFilters"
import { requireEmployee } from "@/lib/auth/context"
import { recurringPreview } from "@/lib/billing/recurring-statements"
import { RecurringStatementsPanel } from "@/app/ops/faturacao/contas-corrente/RecurringStatementsPanel"
import { getBillingConfigAction, getMoloniDetailsAction } from "@/app/actions/billing-config"
import { BillingConfigClient } from "./components/BillingConfigClient"
import { MoloniEnvironmentSwitch } from "./components/MoloniEnvironmentSwitch"
import { getMoloniConfigAction } from "@/app/actions/moloni"

export const dynamic = "force-dynamic"

export default async function FaturacaoConfigPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  await requireOpsPageAccess("/ops/configuracao/faturacao")

  const ctx = await requireEmployee()
  const [billingConfig, moloniDetails, automationPreview, moloniConfig] = await Promise.all([
    getBillingConfigAction(),
    getMoloniDetailsAction(),
    recurringPreview(ctx.tenant_id),
    getMoloniConfigAction(),
  ])

  const selection = billingViewSelection(await searchParams || {}, billingConfig.defaultGrouping)

  return (
    <BillingConfigClient 
      initialConfig={billingConfig} 
      moloniDetails={moloniDetails}
      environmentSwitch={<MoloniEnvironmentSwitch
        environment={moloniConfig.environment}
        connections={"connections" in moloniConfig ? moloniConfig.connections : undefined}
        canSwitch={ctx.role === "admin"}
        clientId={moloniConfig.clientId}
        redirectUri={moloniConfig.redirectUri}
      />}
      automationSettings={<div className="space-y-3">
        <RecurringStatementsPanel initialPreview={automationPreview} canManage={ctx.role === "admin"} />
        <BillingViewFilters key={`${selection.startDate}:${selection.endDate}:${selection.grouping}`} initialSelection={selection} />
      </div>} 
    />
  )
}
