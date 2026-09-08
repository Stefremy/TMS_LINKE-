import { createAdminClient } from "@/lib/supabase/server"
import { EnviosClient } from "./components/EnviosClient"

export default async function EnviosPage() {
  const supabase = createAdminClient()

  // Fetch real data from DB
  const [shipmentsResult, recolhasResult, clientsResult] = await Promise.all([
    supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("recolhas")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .order("name", { ascending: true })
  ])

  if (shipmentsResult.error) console.error("Error fetching shipments:", shipmentsResult.error)
  if (recolhasResult.error) console.error("Error fetching recolhas:", recolhasResult.error)
  if (clientsResult.error) console.error("Error fetching clients:", clientsResult.error)

  const shipments = shipmentsResult.data || []
  const recolhas = recolhasResult.data || []
  const clients = clientsResult.data || []

  // Map to the shape expected by EnviosClient (formerly mock data)
  const mappedEnvios = shipments.map((s: any) => ({
    rawId: s.id,
    trk: { 
      id: s.tracking_number || "N/A", 
      date: new Date(s.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }), 
      ref: s.ctt_object_id || s.id.substring(0, 8).toUpperCase(), 
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
      bgColor: s.service_type?.includes('ctt') ? "bg-red-600" : "bg-blue-600", 
      textColor: "text-white" 
    },
    package: { 
      count: "1 Vol.", // Em produção deve vir da contagem de packages para este shipment
      weight: "1.00 kg" 
    },
    delivery: { 
      date: "--/--/----", 
      time: "--:--" 
    },
    status: { 
      label: s.status, 
      subCode: s.ops_substatus || "", 
      color: "bg-slate-200 text-slate-700" // Cor fixa para simplificar
    },
    value: { 
      amount: s.sell_price ? `${s.sell_price}€` : "0.00€", 
      diff: "0.00€", 
      diffColor: "text-slate-600 border-slate-200 bg-slate-50", 
      ref: "REF" 
    }
  }))

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
      bgColor: "bg-orange-500", 
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
      color: "bg-orange-100 text-orange-700" 
    },
    value: { 
      amount: "0,00€", 
      diff: "0,00€", 
      diffColor: "text-slate-600 border-slate-200 bg-slate-50", 
      ref: "REC" 
    }
  }))

  return (
    <EnviosClient 
      envios={mappedEnvios} 
      recolhas={mappedRecolhas}
      clients={clients} 
    />
  )
}
