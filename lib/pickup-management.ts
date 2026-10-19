import type { CTTPickupRequester } from "@/lib/services/ctt/ctt-types"

export const CTT_PICKUP_PORTAL_URL = "https://portal.cttexpresso.pt/Account/Login"
export const PICKUP_PAGE_SIZE = 50

export interface PickupSummary {
  id: string
  source: "tms" | "ctt"
  ctt_pickup_id: string
  carrier_code: string
  carrier_name: string
  status: string
  scheduled_date: string
  created_at: string
  period?: string
  client_id?: string | null
  volumes?: number
  weight_kg?: number
  heaviest_weight_kg?: number | null
  sender_name?: string
  sender_address?: string
  sender_city?: string
  sender_zip?: string
  sender_contact?: string
  sender_phone?: string
  sender_mobile?: string
  sender_email?: string
  sender_country?: string
  requester?: CTTPickupRequester
  observations?: string
  destination?: string
  dimensions?: { length: number; width: number; height: number }
  connection_id?: string
  objects?: string[]
  objects_checked_at?: string
  collected_at?: string
  manual_confirmation?: { confirmed_at: string; confirmed_by: string }
}

export function normalizePickupObjects(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : value == null ? [] : [value])
    .filter((code): code is string => typeof code === "string")
    .map(code => code.trim().toUpperCase())
    .filter(code => /^[A-Z0-9][A-Z0-9/_-]{0,63}$/.test(code)))]
}

export interface PickupSearch {
  dateFrom?: string
  dateTo?: string
  reference?: string
  status?: string
  page?: number
  connectionId?: string
}

export function validatePickupSearch(input: PickupSearch, remote = false): string | undefined {
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
  if (input.reference && (typeof input.reference !== "string" || input.reference.length > 64)) return "A referência deve ter até 64 caracteres."
  if (Boolean(input.dateFrom) !== Boolean(input.dateTo)) return "Preencha as duas datas."
  if (input.dateFrom && input.dateTo) {
    if (!validDate(input.dateFrom) || !validDate(input.dateTo) || input.dateFrom > input.dateTo) return "Indique um intervalo de datas válido."
    const days = (Date.parse(input.dateTo) - Date.parse(input.dateFrom)) / 86400000 + 1
    if (remote && !input.reference?.trim() && days > 60) return "A pesquisa nos CTT permite até 60 dias por consulta."
  }
  if (remote && !input.reference?.trim() && !input.dateFrom) return "Indique uma referência ou um intervalo de datas."
  if (input.page !== undefined && (!Number.isInteger(input.page) || input.page < 0 || input.page > 1000)) return "Página inválida."
}

export function mapLocalPickup(row: Record<string, unknown>, meta: Record<string, unknown> = {}): PickupSummary {
  const str = (key: string) => String(meta[key] ?? row[key] ?? "")
  const number = (key: string) => {
    const value = meta[key] ?? row[key]
    return value !== undefined && value !== null && Number.isFinite(Number(value)) ? Number(value) : undefined
  }
  const reference = String(row.ctt_pickup_id || meta.pickup_id || "")
  const carrier = str("carrier_code") || (reference.startsWith("CEX") ? "correos_express" : "ctt_expresso")
  return {
    id: String(row.id), source: "tms", ctt_pickup_id: reference, carrier_code: carrier,
    carrier_name: str("carrier_name") || (carrier === "correos_express" ? "Correos Express" : "CTT Expresso"),
    status: String(row.status || "Agendado"), scheduled_date: String(row.scheduled_date || ""), created_at: String(row.created_at || ""),
    period: str("period"), client_id: str("client_id") || null,
    volumes: number("volumes"), weight_kg: number("weight_kg"), heaviest_weight_kg: number("heaviest_weight_kg"),
    sender_name: str("sender_name"), sender_address: str("sender_address"), sender_city: str("sender_city"),
    sender_zip: str("sender_zip"), sender_contact: str("sender_contact"), sender_phone: str("sender_phone"),
    sender_mobile: str("sender_mobile"), sender_email: str("sender_email"), sender_country: str("sender_country"),
    observations: str("observations"), destination: str("destination"), connection_id: str("connection_id"),
    requester: meta.requester as CTTPickupRequester | undefined,
    dimensions: meta.dimensions as PickupSummary["dimensions"],
  }
}
