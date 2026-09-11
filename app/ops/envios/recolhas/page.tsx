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

  // Only expose CTT connections
  const cttConnections = (carrierConnections || []).filter(
    (c: any) =>
      c.carrier_code?.toLowerCase().includes("ctt") ||
      c.supplier_id?.toLowerCase().includes("ctt")
  )

  const mappedClients = (clients || []).map((c: any) => ({
    id: c.id,
    code: c.code || "",
    name: c.short_name || c.legal_name || "Cliente",
    address: c.address || "",
    city: c.city || "",
    postal_code: c.postal_code || "",
    phone: c.mobile_phone || c.phone || "",
  }))

  const mappedConnections = cttConnections.map((c: any) => ({
    id: c.id,
    label: c.description || `CTT Expresso — ${c.environment === "production" ? "Produção" : "QA"}`,
    contract_number: c.contract_number || "",
    client_number: c.client_id || "",
    environment: c.environment || "production",
  }))

  return (
    <RecolhasClient
      recolhas={recolhasResult.data || []}
      clients={mappedClients}
      cttConnections={mappedConnections}
    />
  )
}
