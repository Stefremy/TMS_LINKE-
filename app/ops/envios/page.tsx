import { createAdminClient } from "@/lib/supabase/server"
import { loadFilteredShipmentPage } from "@/lib/services/shipments/filtered-shipment-list"
import { readShipmentListFilters } from "@/lib/services/shipments/shipment-list-filters"
import { requireEmployee } from "@/lib/auth/context"
import { getClientesAction } from "@/app/actions/clientes"
import { EnviosClient } from "./components/EnviosClient"

import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { pickupDateDisplay } from "@/lib/services/shipments/shipment-pickup-dates"
import { formatDeclaredWeight } from '@/lib/services/shipments/parcel-summary'

export default async function EnviosPage(props: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams || {}
  const ctx = await requireEmployee()
  const supabase = createAdminClient()
  const filters = readShipmentListFilters(searchParams)
  
  const page = parseInt(searchParams.page || "1", 10)
  const search = searchParams.search || ""
  const status = searchParams.status || undefined

  const loadRecolhas = async () => {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase.from("recolhas").select("*").eq("tenant_id", ctx.tenant_id)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999)
      if (result.error) return { data: [], error: result.error }
      rows.push(...(result.data || []))
      if (!result.data || result.data.length < 1000) return { data: rows, error: null }
    }
  }

  // Fetch real data from DB & persistent actions
  const [paginatedResult, recolhasResult, clients] = await Promise.all([
    loadFilteredShipmentPage({ page, search, status, filters }),
    loadRecolhas(),
    getClientesAction()
  ])

  if (recolhasResult.error) console.error("Error fetching recolhas:", recolhasResult.error)

  const recolhas = recolhasResult.data || []

  // Map to the shape expected by EnviosClient (formerly mock data)
  const mappedEnvios = paginatedResult.data.map((s: any) => {
    const statusCfg = getShipmentStatusConfig(s.status)
    const isCorreos = s.carrier_code === "correos" || 
                      s.carrier_code === "correos_express" ||
                      (typeof s.service_type === "string" && s.service_type.toLowerCase().includes("correos")) ||
                      /^\d{16}$/.test(s.carrier_tracking_number || "")

    const isRealCarrierTracking = (val?: string) => val && (
      /^(EQ|DD|DB|DA|EG|EA)/i.test(val.trim()) ||
      /^\d{16}$/.test(val.trim())
    )

    const carrierCode = isCorreos
      ? (s.carrier_tracking_number || s.carrier_object_id || s.tracking_number || "N/A")
      : isRealCarrierTracking(s.carrier_tracking_number)
      ? s.carrier_tracking_number
      : isRealCarrierTracking(s.tracking_number)
      ? s.tracking_number
      : isRealCarrierTracking(s.ctt_object_id)
      ? s.ctt_object_id
      : s.carrier_tracking_number || s.tracking_number || s.ctt_object_id || "N/A"

    const internalRef = (s.reference?.startsWith("LTK") ? s.reference : null)
      || (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null)
      || (s.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
      || s.reference
      || (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null)
      || null

    const carrierName = isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso")

    return {
      rawId: s.id,
      rawShipment: s,
      parcel_summary: s.parcel_summary,
      billing_statement_id: s.billing_statement_id,
      trk: { 
        id: carrierCode, 
        date: new Date(s.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }), 
        ref: internalRef, 
        carrierRef: carrierCode,
        carrierName: carrierName,
        tag: "A01" 
      },
      sender: { 
        name: s.sender_name || "N/A", 
        flag: "PT", // Simplification
        zip: (s.sender_zip4 && s.sender_zip3) ? `${s.sender_zip4}-${s.sender_zip3}` : (s.sender_zip4 || s.sender_zip3 || ""), 
        city: s.sender_address || "N/A", 
        phone: "" 
      },
      recipient: { 
        name: s.recipient_name || "N/A", 
        flag: "PT", 
        zip: (s.recipient_zip4 && s.recipient_zip3) ? `${s.recipient_zip4}-${s.recipient_zip3}` : (s.recipient_zip4 || s.recipient_zip3 || ""), 
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
      count: s.parcel_summary?.volumeCount ? `${s.parcel_summary.volumeCount} Vol.` : '—',
      weight: formatDeclaredWeight(s.parcel_summary?.declaredWeightKg)
    },
    delivery: { 
      date: s.status === 'entregue' ? new Date(s.updated_at || s.created_at).toLocaleDateString('pt-PT') : "--/--/----", 
      time: s.status === 'entregue' ? new Date(s.updated_at || s.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "--:--" 
    },
    pickup: pickupDateDisplay(s.picked_up_at),
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
  rawId: r.id,
  rawShipment: { ...r, service_type: "Recolha", carrier_code: r.carrier_code || "ctt", picked_up_at: r.scheduled_date },
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
      pagination={{
        page: paginatedResult.page,
        totalPages: paginatedResult.totalPages,
        total: paginatedResult.total
      }}
      filterFacets={paginatedResult.facets}
      initialFilters={filters}
      filterError={paginatedResult.filterError}
      initialSearch={search}
      initialStatus={status}
    />
  )
}
