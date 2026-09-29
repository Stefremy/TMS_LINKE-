import * as React from "react"
import FaturasClient from "./FaturasClient"
import { getClientesAction } from "@/app/actions/clientes"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import { requireUser } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function FaturasPage() {
  const ctx = await requireUser()
  const targetClient = ctx.client_id
    ? (await getClientesAction(ctx.client_id)).find(c => c.id === ctx.client_id)
    : undefined

  const statements = targetClient ? await getBillingStatementsAction(targetClient.id) : []

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Faturas e Extratos</h1>
          <p className="text-slate-500 mt-1">
            Consulte o histórico de faturação e os respetivos detalhes de envios {targetClient ? `de ${targetClient.legal_name || targetClient.short_name}` : ""}.
          </p>
        </div>
        
        <FaturasClient statements={statements || []} />
      </div>
    </div>
  )
}
