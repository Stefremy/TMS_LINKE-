"use server"

import { getShipmentsAction } from "./shipments"
import { getClientesAction } from "./clientes"
import { Destinatario } from "@/app/ops/entidades/destinatarios/types"

/**
 * Obtém todos os destinatários únicos a partir do histórico de envios criados pelos clientes.
 */
export async function getDestinatariosAction(): Promise<Destinatario[]> {
  try {
    const [shipments, clients] = await Promise.all([
      getShipmentsAction(),
      getClientesAction(),
    ])

    const clientMap = new Map<string, any>()
    clients.forEach((c) => clientMap.set(c.id, c))

    const destMap = new Map<string, Destinatario>()

    shipments.forEach((s) => {
      const rawName = (s.recipient_name || "").trim()
      if (!rawName) return

      const rawAddress = (s.recipient_address || "").trim()
      const zip = s.recipient_zip || (s.recipient_zip4 ? `${s.recipient_zip4}-${s.recipient_zip3 || "000"}` : "")
      const city = s.recipient_city || (rawAddress.includes(",") ? rawAddress.split(",").pop()?.trim() || "" : "")
      const client = clientMap.get(s.client_id)
      const clientName = client?.short_name || client?.legal_name || s.sender_name || "Cliente Linke"

      // Chave única de agrupamento: nome + código postal + cliente
      const key = `${rawName.toLowerCase()}__${zip.toLowerCase()}__${(s.client_id || "")}`

      if (!destMap.has(key)) {
        const generatedId = "dest_" + Buffer.from(key).toString("hex")
        destMap.set(key, {
          id: generatedId,
          name: rawName,
          address: rawAddress,
          postal_code: zip,
          city: city,
          country: s.recipient_country || "PT",
          phone: s.recipient_phone,
          email: s.recipient_email,
          client_id: s.client_id,
          client_name: clientName,
          total_shipments: 0,
          last_shipment_date: s.created_at,
          last_tracking_number: s.ctt_object_id || s.tracking_number,
          last_status: s.status,
          shipments_history: [],
        })
      }

      const d = destMap.get(key)!
      d.total_shipments += 1

      d.shipments_history.push({
        id: s.id,
        tracking_number: s.tracking_number,
        ctt_object_id: s.ctt_object_id,
        created_at: s.created_at,
        status: s.status,
        service_type: s.service_type,
        sell_price: s.sell_price,
        buy_price: s.buy_price,
        weight_kg: s.weight_kg,
      })

      // Atualizar dados de contacto se estiverem disponíveis neste envio
      if (!d.phone && s.recipient_phone) d.phone = s.recipient_phone
      if (!d.email && s.recipient_email) d.email = s.recipient_email

      // Atualizar última data e tracking mais recente
      if (new Date(s.created_at).getTime() >= new Date(d.last_shipment_date).getTime()) {
        d.last_shipment_date = s.created_at
        d.last_tracking_number = s.ctt_object_id || s.tracking_number
        d.last_status = s.status
      }
    })

    // Ordenar histórico interno de cada destinatário (mais recente primeiro)
    destMap.forEach((d) => {
      d.shipments_history.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })

    // Ordenar destinatários pelo envio mais recente
    return Array.from(destMap.values()).sort(
      (a, b) => new Date(b.last_shipment_date).getTime() - new Date(a.last_shipment_date).getTime()
    )
  } catch (error) {
    console.error("[getDestinatariosAction] Erro ao carregar destinatários:", error)
    return []
  }
}
