import { getOpsCodWorkflowAction } from "@/app/actions/ops-client-cod"
import { ReembolsosWorkspace } from "./ReembolsosWorkspace"
import { currentCodMonth } from "@/lib/services/reembolsos/client-cod"
import { lisbonDate } from "@/lib/billing/recurring-periods"
import * as React from "react"
import { getReembolsoBatchesAction } from "@/app/actions/reembolsos"
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
  const [batches,workflow] = await Promise.all([
    getReembolsoBatchesAction(),
    getOpsCodWorkflowAction().then(data=>({data,error:''})).catch(()=>({data:null,error:'Não foi possível carregar as cobranças e os pagamentos. Atualize antes de continuar.'})),
  ])

  return <ReembolsosWorkspace data={workflow.data} error={workflow.error} batches={batches} initialPeriod={currentCodMonth(lisbonDate())} />
}
