import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { IncidenciasClient, IncidentShipment } from "./IncidenciasClient"
import { CTT_NON_DELIVERY_REASONS } from "@/lib/services/ctt/ctt-types"

export const metadata = {
  title: "Incidências Operacionais | Linke TMS",
  description: "Gestão e resolução de ocorrências e incidências de entregas Linke TMS",
}

export default async function IncidenciasPage() {
  const [shipments, clients] = await Promise.all([
    getShipmentsAction(),
    getClientesAction()
  ])

  // Filter ONLY real incidents from database
  const realIncidents: IncidentShipment[] = (shipments || [])
    .filter((s: any) => s.status === "incidencia" || (s.ops_substatus && s.ops_substatus.toLowerCase().includes("incid")))
    .map((s: any) => {
      const carrierTracking = s.ctt_object_id || s.tracking_number || "N/A"
      const clientObj = clients.find((c: any) => c.id === s.client_id)
      const clientName = clientObj?.short_name || clientObj?.legal_name || s.sender_name || "Cliente Linke"
      
      const incidentDate = s.updated_at 
        ? new Date(s.updated_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) 
        : new Date(s.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })

      // Calculate SLA hours
      const diffMs = Date.now() - new Date(s.updated_at || s.created_at).getTime()
      const slaHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))

      const codeMatch = s.ops_substatus?.match(/^(\d{2})/)?.[1] || "11"
      const reasonLabel = CTT_NON_DELIVERY_REASONS[codeMatch] || s.ops_substatus || "Destinatário ausente na morada"

      return {
        id: s.id,
        rawId: s.id,
        tracking_number: s.tracking_number || carrierTracking,
        ctt_object_id: carrierTracking,
        reference: s.reference || s.tracking_number,
        carrier_name: s.carrier_name || "CTT Expresso",
        service_type: s.service_type || "Expresso D+1",
        created_at: s.created_at,
        updated_at: s.updated_at,
        incident_date: incidentDate,
        client_name: clientName,
        client_id: s.client_id,
        recipient_name: s.recipient_name || "Destinatário",
        recipient_phone: s.recipient_phone || "",
        recipient_address: s.recipient_address || "Morada indicada no envio",
        recipient_zip: (s.recipient_zip3 && s.recipient_zip4) ? `${s.recipient_zip3}-${s.recipient_zip4}` : (s.recipient_zip3 || ""),
        recipient_city: s.recipient_address?.split(",")?.pop()?.trim() || "Portugal",
        incident_code: codeMatch,
        incident_reason: reasonLabel,
        incident_notes: s.status_reason || s.ops_substatus || "Tentativa de entrega falhada.",
        sla_hours: slaHours,
        status_tratamento: "pendente",
        attempts_count: 1,
        rawShipment: s
      }
    })

  return (
    <IncidenciasClient
      initialIncidents={realIncidents}
      clients={clients.map((c: any) => ({
        id: c.id,
        name: c.short_name || c.legal_name || "Cliente"
      }))}
    />
  )
}
