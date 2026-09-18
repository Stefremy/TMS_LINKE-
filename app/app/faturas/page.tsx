import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import * as React from "react"
import FaturasClient from "./FaturasClient"

export default async function FaturasPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
    
  // Obter o cliente atual
  const { data: clientUser } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .single()
    
  if (!clientUser?.client_id) {
    return <div>Cliente não encontrado</div>
  }

  // Obter faturas/extratos do cliente
  const { data: statements } = await supabase
    .from('billing_statements')
    .select(\`
      *,
      shipments:shipments(id, tracking_number, reference, sell_price, created_at, recipient_name, recipient_city)
    \`)
    .eq('client_id', clientUser.client_id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Faturas e Extratos</h1>
          <p className="text-slate-500 mt-1">Consulte o histórico de faturação e os respetivos detalhes de envios.</p>
        </div>
        
        <FaturasClient statements={statements || []} />
      </div>
    </div>
  )
}
