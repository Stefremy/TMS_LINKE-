import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import ContasCorrenteClient from "./ContasCorrenteClient"

export const dynamic = "force-dynamic"

export default async function ContasCorrentePage() {
  const [clients, shipments, statements] = await Promise.all([
    getClientesAction(),
    getShipmentsAction(),
    getBillingStatementsAction()
  ])

  // Filtrar envios já faturados em extratos emitidos
  const invoicedShipmentIds = new Set<string>()
  statements.forEach((stmt: any) => {
    if (Array.isArray(stmt.shipment_ids)) {
      stmt.shipment_ids.forEach((id: string) => invoicedShipmentIds.add(id))
    }
  })

  // Apenas envios pendentes de faturação
  const pendingShipments = shipments.filter((s: any) => !invoicedShipmentIds.has(s.id))
  
  return (
    <div className="p-6">
      <ContasCorrenteClient 
        clients={clients} 
        shipments={pendingShipments} 
        statements={statements}
      />
    </div>
  )
}

