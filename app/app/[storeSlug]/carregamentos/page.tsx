import * as React from "react"
import FaturasClient from "../../faturas/FaturasClient"
import { getBillingStatementsAction } from "@/app/actions/moloni"
import { getClientTransactionsAction } from "@/app/actions/stripe"
import { requirePortalStore } from "@/lib/client-portal/access"

export const dynamic = "force-dynamic"

export default async function CarregamentosPage({ 
  params 
}: { 
  params: Promise<{ storeSlug: string }> 
}) {
  const { storeSlug } = await params
  const { client: targetClient } = await requirePortalStore(storeSlug)

  const [statements, transactions] = await Promise.all([
    targetClient ? getBillingStatementsAction(targetClient.id) : Promise.resolve([]),
    targetClient ? getClientTransactionsAction(targetClient.id) : Promise.resolve([]),
  ])

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Carteira & Carregamentos</h1>
          <p className="text-slate-500 mt-1">
            Consulte o saldo disponível, histórico de carregamentos via Stripe e faturas associadas {targetClient ? `de ${targetClient.legal_name || targetClient.short_name}` : ""}.
          </p>
        </div>
        
        <FaturasClient 
          statements={statements || []} 
          transactions={transactions || []}
          initialTab="carregamentos"
        />
      </div>
    </div>
  )
}
