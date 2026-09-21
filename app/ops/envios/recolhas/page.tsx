import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { RecolhasClient } from "./RecolhasClient"

export default async function RecolhasPage() {
  const supabase = createAdminClient()

  const [recolhasResult, clients, carrierConnections] = await Promise.all([
    supabase.from("recolhas").select("*").order("created_at", { ascending: false }),
    getClientesAction(),
    getCarrierConnectionsAction(),
  ])

  if (recolhasResult.error) {
    console.error("Error fetching recolhas:", recolhasResult.error)
  }

  const mappedClients = (clients || []).map((c: any) => ({
    id: c.id,
    code: c.code || "",
    name: c.short_name || c.legal_name || "Cliente",
    address: c.address || "",
    city: c.city || "",
    postal_code: c.postal_code || "",
    phone: c.mobile_phone || c.phone || "",
  }))

  const mappedConnections = (carrierConnections || []).map((c: any) => {
    // Determine a friendly name based on carrier code if description is missing
    let friendlyName = c.carrier_code || "Operadora"
    if (friendlyName === "ctt_expresso") friendlyName = "CTT Expresso"
    else if (friendlyName === "correos_express") friendlyName = "Correos Express"

    return {
      id: c.id,
      label: c.description || `${friendlyName} — ${c.environment === "production" ? "Produção" : "QA"}`,
      contract_number: c.contract_number || "",
      client_number: c.client_id || "",
      environment: c.environment || "production",
      carrier_code: c.carrier_code || "",
    }
  })

  return (
    <RecolhasClient
      recolhas={recolhasResult.data || []}
      clients={mappedClients}
      carrierConnections={mappedConnections}
    />
  )
}
