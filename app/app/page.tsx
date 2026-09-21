import * as React from "react"
import { Suspense } from "react"
import { ClientDashboard } from "./components/ClientDashboard"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export default async function ClientStorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const { redirect } = await import("next/navigation")
    redirect("/login")
  }

  const { data: clientUser } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user?.id)
    .single()

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-sm font-medium">A carregar painel de análise do cliente...</span>
        </div>
      }
    >
      <ClientDashboard userEmail={user?.email} passedClientId={clientUser?.client_id} />
    </Suspense>
  )
}

