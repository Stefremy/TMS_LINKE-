import { createAdminClient } from "@/lib/supabase/server"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { EnviosClient } from "./components/EnviosClient"

import { getShipmentStatusConfig } from "@/lib/status-helpers"

export default async function EnviosPage() {
  const supabase = createAdminClient()

  // Fetch real data from DB & persistent actions
  const [shipments, recolhasResult, clients] = await Promise.all([
    getShipmentsAction(),
    supabase
      .from("recolhas")
      .select("*")
      .order("created_at", { ascending: false }),
    getClientesAction()
  ])

  if (recolhasResult.error) console.error("Error fetching recolhas:", recolhasResult.error)

  const recolhas = recolhasResult.data || []

  // Map to the shape expected by EnviosClient (formerly mock data)
  const mappedEnvios = shipments.map((s: any) => {
    const statusCfg = getShipmentStatusConfig(s.status)
    const isRealCarrierTracking = (val?: string) => val && /^(EQ|DD|DB|DA|EG|EA)/i.test(val.trim())
    const carrierCode = isRealCarrierTracking(s.tracking_number)
      ? s.tracking_number
      : isRealCarrierTracking(s.ctt_object_id)
      ? s.ctt_object_id
      : s.tracking_number || s.ctt_object_id || "N/A"
    const internalRef = (s.reference?.startsWith("LTK") ? s.reference : null)
      || (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null)
      || (s.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
      || s.reference
      || (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null)
      || null

    return {
      rawId: s.id,
      rawShipment: s,
      trk: { 
        id: carrierCode, 
        date: new Date(s.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }), 
        ref: internalRef, 
        carrierRef: carrierCode,
        carrierName: s.carrier_name || "CTT Expresso",
        tag: "A01" 
      },
      sender: { 
        name: s.sender_name || "N/A", 
        flag: "PT", // Simplification
        zip: (s.sender_zip3 && s.sender_zip4) ? `${s.sender_zip3}-${s.sender_zip4}` : (s.sender_zip3 || ""), 
        city: s.sender_address || "N/A", 
        phone: "" 
      },
      recipient: { 
        name: s.recipient_name || "N/A", 
        flag: "PT", 
        zip: (s.recipient_zip3 && s.recipient_zip4) ? `${s.recipient_zip3}-${s.recipient_zip4}` : (s.recipient_zip3 || ""), 
        city: s.recipient_address || "N/A", 
        phone: "" 
      },
    service: { 
      code: s.service_type || "N/A", 
      name: s.service_type?.includes('ctt') ? "CTT Expresso" : s.service_type, 
      bgColor: s.service_type?.includes('ctt') ? "bg-[var(--status-critical)]" : "bg-[var(--status-info)]", 
      textColor: "text-white" 
    },
    package: { 
      count: "1 Vol.", // Em produção deve vir da contagem de packages para este shipment
      weight: "1.00 kg" 
    },
    delivery: { 
      date: s.status === 'entregue' ? new Date(s.updated_at || s.created_at).toLocaleDateString('pt-PT') : "--/--/----", 
      time: s.status === 'entregue' ? new Date(s.updated_at || s.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "--:--" 
    },
    status: { 
      label: statusCfg.label, 
      raw: s.status,
      subCode: s.ops_substatus || "", 
      color: statusCfg.color,
      dotColor: statusCfg.dotColor
    },
    value: { 
      amount: s.sell_price ? `${s.sell_price}€` : "0.00€", 
      diff: "0.00€", 
      diffColor: "text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--surface-muted)]", 
      ref: "REF" 
    }
  }
})

const mappedRecolhas = recolhas.map((r: any) => ({
  trk: { 
    id: r.ctt_pickup_id || r.id.substring(0, 8).toUpperCase(), 
    date: new Date(r.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }), 
    ref: r.id.substring(0, 8).toUpperCase(), 
    tag: "R01" 
  },
  sender: { 
    name: "Armazém Principal", 
    flag: "PT", 
    zip: "4000-001", 
    city: "PORTO, PT", 
    phone: "" 
  },
  recipient: { 
    name: "CTT Correios", 
    flag: "PT", 
    zip: "-", 
    city: "-", 
    phone: "" 
  },
  service: { 
    code: "REC", 
    name: "Recolha", 
    bgColor: "bg-[var(--status-warning)]", 
    textColor: "text-white" 
  },
  package: { 
    count: "- Vol.", 
    weight: "- kg" 
  },
  delivery: { 
    date: r.scheduled_date || "--/--/----", 
    time: "--:--" 
  },
  status: { 
    label: r.status, 
    subCode: "", 
    color: "bg-[var(--status-warning-soft)] text-[var(--status-warning)]" 
  },
  value: { 
    amount: "0,00€", 
    diff: "0,00€", 
    diffColor: "text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--surface-muted)]", 
    ref: "REC" 
  }
}))

  return (
    <EnviosClient 
      envios={mappedEnvios} 
      recolhas={mappedRecolhas}
      clients={clients.map(c => ({ id: c.id, name: c.short_name || c.legal_name || "Cliente" }))} 
    />
  )
}
