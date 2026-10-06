import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction, getMoloniConfigAction } from "@/app/actions/moloni"
import ContasCorrenteClient from "./ContasCorrenteClient"

export const dynamic = "force-dynamic"

export default async function ContasCorrentePage() {
  const [clients, shipments, statements, moloniConfig] = await Promise.all([
    getClientesAction(),
    getShipmentsAction({ includeLabels: false, createdAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() }),
    getBillingStatementsAction(),
    getMoloniConfigAction()
  ])

  // Filtrar envios já faturados em faturas oficiais Moloni
  const invoicedShipmentIds = new Set<string>()
  statements.forEach((stmt: any) => {
    if (stmt.moloni_document_id && Array.isArray(stmt.shipment_ids)) {
      stmt.shipment_ids.forEach((id: string) => invoicedShipmentIds.add(id))
    }
  })

  // Apenas envios pendentes de faturação
  const pendingShipments = shipments.filter((s: any) => !invoicedShipmentIds.has(s.id))
  
  return (
    <div className="space-y-6">
      <ContasCorrenteClient 
        clients={clients} 
        shipments={pendingShipments} 
        statements={statements}
        moloniConfig={moloniConfig}
      />
    </div>
  )
}
