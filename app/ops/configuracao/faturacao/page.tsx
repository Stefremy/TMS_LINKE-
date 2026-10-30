import { billingViewSelection } from "@/lib/billing/view-filters"
import { BillingViewFilters } from "./components/BillingViewFilters"
import { requireEmployee } from "@/lib/auth/context"
import { recurringPreview } from "@/lib/billing/recurring-statements"
import { RecurringStatementsPanel } from "@/app/ops/faturacao/contas-corrente/RecurringStatementsPanel"
import { getBillingConfigAction, getMoloniDetailsAction } from "@/app/actions/billing-config"
import { BillingConfigClient } from "./components/BillingConfigClient"

export const dynamic = "force-dynamic"

export default async function FaturacaoConfigPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const ctx = await requireEmployee()
  const [billingConfig, moloniDetails, automationPreview] = await Promise.all([
    getBillingConfigAction(),
    getMoloniDetailsAction(),
    recurringPreview(ctx.tenant_id),
  ])

  const selection = billingViewSelection(await searchParams || {}, billingConfig.defaultGrouping)

  return (
    <BillingConfigClient 
      initialConfig={billingConfig} 
      moloniDetails={moloniDetails}
      automationSettings={<div className="space-y-3">
        <RecurringStatementsPanel initialPreview={automationPreview} canManage={ctx.role === "admin"} />
        <BillingViewFilters key={`${selection.startDate}:${selection.endDate}:${selection.grouping}`} initialSelection={selection} />
      </div>} 
    />
  )
}
