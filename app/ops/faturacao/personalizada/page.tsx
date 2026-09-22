import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getCustomInvoicesAction, getMoloniConfigAction } from "@/app/actions/moloni"
import FaturaPersonalizadaClient from "./FaturaPersonalizadaClient"

export const dynamic = "force-dynamic"

export default async function FaturaPersonalizadaPage() {
  const [clients, initialInvoices, moloniConfig] = await Promise.all([
    getClientesAction(),
    getCustomInvoicesAction(),
    getMoloniConfigAction()
  ])

  return (
    <FaturaPersonalizadaClient 
      clients={clients} 
      initialInvoices={initialInvoices}
      moloniConfig={moloniConfig}
    />
  )
}
