import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction, getMoloniConfigAction } from "@/app/actions/moloni"
import ContasCorrenteClient from "./ContasCorrenteClient"

export const dynamic = "force-dynamic"

export default async function ContasCorrentePage() {
  const [clients, shipments, statements, moloniConfig] = await Promise.all([
    getClientesAction(),
    getShipmentsAction(),
    getBillingStatementsAction(),
    getMoloniConfigAction()
  ])

  // Filtrar envios já faturados em extratos emitidos
  const invoicedShipmentIds = new Set<string>()
  statements.forEach((stmt: any) => {
    // A Fatura Linke (pro-forma) não tem valor tributário. 
    // Por isso, os envios não passam imediatamente a faturados, a não ser que já tenham uma fatura oficial Moloni.
    if (!stmt.is_pro_forma || stmt.moloni_document_id) {
      if (Array.isArray(stmt.shipment_ids)) {
        stmt.shipment_ids.forEach((id: string) => invoicedShipmentIds.add(id))
      }
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

