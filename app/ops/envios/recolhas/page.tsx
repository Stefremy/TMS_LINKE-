import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { RecolhasClient } from "./RecolhasClient"
import { getCttPickupRequester } from "@/lib/config/ctt-pickup-requester"

export default async function RecolhasPage() {
  const supabase = createAdminClient()

  const [recolhasResult, auditLogsResult, clients, carrierConnections] = await Promise.all([
    supabase.from("recolhas").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_log").select("*").eq("action", "recolha_data").order("created_at", { ascending: false }).limit(100),
    getClientesAction(),
    getCarrierConnectionsAction(),
  ])

  if (recolhasResult.error) {
    console.error("Error fetching recolhas:", recolhasResult.error)
  }

  const auditLogs = auditLogsResult.data || []
  const auditByPickupId = new Map<string, any>()
  const auditByRecolhaId = new Map<string, any>()
  for (const log of auditLogs) {
    if (log.details?.pickup_id) auditByPickupId.set(String(log.details.pickup_id).trim(), log.details)
    if (log.details?.recolha_id) auditByRecolhaId.set(String(log.details.recolha_id).trim(), log.details)
  }

  const mappedRecolhas = (recolhasResult.data || []).map((r: any) => {
    const meta = auditByRecolhaId.get(r.id) || auditByPickupId.get(r.ctt_pickup_id) || {}
    const isCorreos = meta.carrier_code === "correos_express" || (r.ctt_pickup_id && String(r.ctt_pickup_id).startsWith("CEX"))
    const carrierCode = meta.carrier_code || (isCorreos ? "correos_express" : "ctt_expresso")
    const carrierName = meta.carrier_name || (carrierCode === "correos_express" ? "Correos Express" : "CTT Expresso")

    return {
      id: r.id,
      ctt_pickup_id: r.ctt_pickup_id || meta.pickup_id || "",
      carrier_code: carrierCode,
      carrier_name: carrierName,
      status: r.status || "Agendado",
      scheduled_date: r.scheduled_date || "",
      created_at: r.created_at,
      volumes: meta.volumes ?? r.volumes ?? 1,
      weight_kg: meta.weight_kg ?? r.weight_kg ?? 1,
      heaviest_weight_kg: meta.heaviest_weight_kg ?? null,
      sender_name: meta.sender_name ?? r.sender_name ?? "Armazém Principal",
      sender_address: meta.sender_address ?? r.sender_address ?? "",
      sender_city: meta.sender_city ?? r.sender_city ?? "",
      period: meta.period ?? r.period ?? "09:00-19:00",
      observations: meta.observations ?? r.observations ?? "",
      client_id: meta.client_id ?? r.client_id ?? null,
    }
  })

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
      clients={mappedClients}
      carrierConnections={mappedConnections}
      requesterContact={getCttPickupRequester()}
    />
  )
}

