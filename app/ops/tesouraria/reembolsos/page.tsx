import { getOpsCodClientsAction } from "@/app/actions/ops-client-cod"
import { OpsCodCollectionsPanel } from "./OpsCodCollectionsPanel"
import { currentCodMonth } from "@/lib/services/reembolsos/client-cod"
import { lisbonDate } from "@/lib/billing/recurring-periods"
import { CodPayoutRequestsPanel } from "./CodPayoutRequestsPanel"
import * as React from "react"
import { getReembolsoBatchesAction, getCodPayoutInboxAction } from "@/app/actions/reembolsos"
import ReembolsosClient from "./ReembolsosClient"
import { requireEmployee } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function ReembolsosPage() {
  const ctx = await requireEmployee()
  if (ctx.role !== "admin" && !ctx.permissions.includes("Faturação & Contas Correntes")) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p>Esta área requer permissão de Faturação &amp; Contas Correntes. Contacte um administrador para solicitar acesso.</p>
      </div>
    )
  }
  const [batches,clients,inbox] = await Promise.all([
    getReembolsoBatchesAction(),
    getOpsCodClientsAction().then(data=>({data,error:''})).catch(()=>({data:[],error:'Não foi possível carregar os clientes para consulta.'})),
    getCodPayoutInboxAction().then(data=>({data,error:''})).catch(()=>({data:null,error:'Não foi possível consultar os pedidos dos clientes.'})),
  ])

  return (
    <div className="space-y-6">
      <OpsCodCollectionsPanel clients={clients.data} clientError={clients.error} initialPeriod={currentCodMonth(lisbonDate())} />
      <CodPayoutRequestsPanel rows={inbox.data} error={inbox.error} />
      <ReembolsosClient initialBatches={batches} />
    </div>
  )
}
