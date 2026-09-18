import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import ContasCorrenteClient from "./ContasCorrenteClient"

export const dynamic = "force-dynamic"

export default async function ContasCorrentePage() {
  const clients = await getClientesAction()
  const shipments = await getShipmentsAction()

  // Filtramos os envios para apenas mostrar os que ainda não estão faturados 
  // (Num cenário real teríamos uma coluna "invoiced_at" ou "invoice_id". 
  // Por enquanto filtramos todos os que existem).
  
  return (
    <div className="p-6">
      <ContasCorrenteClient clients={clients} shipments={shipments} />
    </div>
  )
}
