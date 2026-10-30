import { loadBillingStatistics } from '@/lib/billing/statistics-data'
import { BillingPlanningPanel } from './BillingPlanningPanel'
import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction, getMoloniConfigAction } from "@/app/actions/moloni"
import ContasCorrenteClient from "./ContasCorrenteClient"
import { requirePermission } from '@/lib/auth/context'
import { recurringPlanningPreview, loadPeriodStatements } from '@/lib/billing/recurring-statements'
import { billingViewSelection } from '@/lib/billing/view-filters'
import { canInvoiceShipment } from '@/lib/billing/shipment-eligibility'
import { isPrepaidShipment } from '@/lib/billing/client-balance'

export const dynamic = "force-dynamic"

export default async function ContasCorrentePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const ctx = await requirePermission('Faturação & Contas Correntes')
  const selection = billingViewSelection(await searchParams || {})
  const [clients, shipments, statements, moloniConfig, recurring, periodStatements] = await Promise.all([
    getClientesAction(),
    getShipmentsAction({ includeLabels: false, createdAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() }),
    getBillingStatementsAction(),
    getMoloniConfigAction(),
    recurringPlanningPreview(ctx.tenant_id),
    loadPeriodStatements(ctx.tenant_id),
  ])

  const planning = await loadBillingStatistics(clients)
    .then(data => ({ data, error: undefined as string | undefined }))
    .catch(() => ({ data: null, error: 'Não foi possível carregar os vencimentos das faturas. Tente atualizar os dados.' }))

  // Filtrar envios já faturados em faturas oficiais Moloni
  const invoicedShipmentIds = new Set<string>()
  statements.forEach((stmt: any) => {
    if (stmt.moloni_document_id && Array.isArray(stmt.shipment_ids)) {
      stmt.shipment_ids.forEach((id: string) => invoicedShipmentIds.add(id))
    }
  })

  // Apenas envios pendentes de faturação (pré-pagos são pagos pela wallet e nunca são faturados)
  const clientsById = new Map(clients.map((c: { id: string }) => [c.id, c]))
  const pendingShipments = shipments.filter((s: { id: string; status?: string | null; client_id?: string; created_at?: string | null }) =>
    canInvoiceShipment(s) && !invoicedShipmentIds.has(s.id) && !isPrepaidShipment(clientsById.get(s.client_id || "") as never, s))
  
  return (
    <div className="space-y-6">
      <ContasCorrenteClient
        key={`${selection.startDate}:${selection.endDate}:${selection.grouping}`}
        initialSelection={selection}
        clients={clients} 
        shipments={pendingShipments} 
        statements={statements}
        moloniConfig={moloniConfig}
        periodStatements={periodStatements}
        planningPanel={<BillingPlanningPanel statistics={planning.data} statisticsError={planning.error} recurring={recurring} />}
      />
    </div>
  )
}
