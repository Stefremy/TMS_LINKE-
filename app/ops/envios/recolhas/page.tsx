import { searchPickupsAction } from "@/app/actions/pickups"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { RecolhasClient } from "./RecolhasClient"
import { getCttPickupRequester } from "@/lib/config/ctt-pickup-requester"

export default async function RecolhasPage() {
  const [recolhasResult, clients, carrierConnections] = await Promise.all([
    searchPickupsAction(),
    getClientesAction(),
    getCarrierConnectionsAction(),
  ])

  if (!recolhasResult.success) console.error("Error fetching recolhas:", recolhasResult.error)
  const mappedRecolhas = recolhasResult.success ? recolhasResult.pickups : []

  const mappedClients = (clients || []).map((c: any) => ({
    id: c.id,
    code: c.code || "",
    name: c.short_name || c.legal_name || "Cliente",
    email: c.email || "",
    address: c.address || "",
    city: c.city || "",
    postal_code: c.postal_code || "",
    phone: c.phone || "",
    mobile_phone: c.mobile_phone || "",
  }))

  const mappedConnections = (carrierConnections || []).map((c: any) => {
    let friendlyName = c.carrier_code || "Operadora"
    if (friendlyName === "ctt_expresso") friendlyName = "CTT Expresso"
    else if (friendlyName === "correos_express") friendlyName = "Correos Express"

    const cleanDesc = (c.description || "").trim()
    const label = cleanDesc && cleanDesc.toLowerCase() !== "integração ctt expresso" && cleanDesc.toLowerCase() !== "correos"
      ? cleanDesc
      : `${friendlyName} (Contrato ${c.contract_number || "—"}) — ${c.environment === "production" ? "Produção" : "QA"}`

    return {
      id: c.id,
      label,
      contract_number: c.contract_number || "",
      client_number: c.client_id || "",
      environment: c.environment || "production",
      carrier_code: c.carrier_code || "ctt_expresso",
    }
  })

  // Se não houver conexões carregadas, fornecer defaults para facilitar testes/uso imediato
  if (mappedConnections.length === 0) {
    mappedConnections.push(
      {
        id: "default-ctt",
        label: "CTT Expresso — Produção",
        contract_number: "300330941",
        client_number: "100032458",
        environment: "production",
        carrier_code: "ctt_expresso",
      },
      {
        id: "default-cex",
        label: "Correos Express — Produção",
        contract_number: "P49240001",
        client_number: "IP49240001",
        environment: "production",
        carrier_code: "correos_express",
      }
    )
  }

  return (
    <RecolhasClient
      recolhas={mappedRecolhas}
      initialError={recolhasResult.success ? undefined : recolhasResult.error}
      clients={mappedClients}
      carrierConnections={mappedConnections}
      requesterContact={getCttPickupRequester()}
    />
  )
}

