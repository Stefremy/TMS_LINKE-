import { createAdminClient } from "@/lib/supabase/server"
import { WebservicesClient } from "./components/WebservicesClient"

export default async function WebservicesPage() {
  const supabase = createAdminClient()
  
  // No TMS, geralmente o tenant_id é filtrado pelo auth context ou admin context.
  // Como estamos num ambiente simplificado/dev, vamos trazer todas as ligações ativas.
  const { data: connections, error } = await supabase
    .from("carrier_connections")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Erro a carregar carrier_connections:", error)
  }

  return <WebservicesClient connections={connections || []} />
}
