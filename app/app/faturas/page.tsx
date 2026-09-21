import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import * as React from "react"
import FaturasClient from "./FaturasClient"
import { getClientesAction } from "@/app/actions/clientes"
import { getBillingStatementsAction } from "@/app/actions/moloni"

export const dynamic = "force-dynamic"

export default async function FaturasPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; clientName?: string }>
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const resolvedParams = searchParams ? await searchParams : {}
  const clients = await getClientesAction()
  
  let targetClient: any = undefined
  if (resolvedParams.clientId) {
    targetClient = clients.find(c => c.id === resolvedParams.clientId)
  }
  if (!targetClient && resolvedParams.clientName) {
    targetClient = clients.find(c => c.short_name?.toLowerCase() === resolvedParams.clientName?.toLowerCase())
  }
  if (!targetClient && user?.email) {
    targetClient = clients.find(c => 
      c.email?.toLowerCase().trim() === user.email?.toLowerCase().trim() ||
      c.billing_email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
    )
  }
  if (!targetClient && clients.length > 0) {
    targetClient = clients[0]
  }

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
