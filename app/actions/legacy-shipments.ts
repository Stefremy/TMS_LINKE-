"use server"

import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"

export type LegacyShipment = {
  id: string
  legacy_trk: string
  carrier_tracking_number: string | null
  reference: string | null
  service: string | null
  recipient_name: string | null
  recipient_zip: string | null
  recipient_city: string | null
  recipient_phone: string | null
  volumes: number | null
  weight_kg: number | null
  status: string | null
  status_at: string | null
  shipped_at: string | null
}

const COLUMNS = "id, legacy_trk, carrier_tracking_number, reference, service, recipient_name, recipient_zip, recipient_city, recipient_phone, volumes, weight_kg, status, status_at, shipped_at"

/** Old-platform shipments of one store: a client only ever sees its own, staff only within their company. */
export async function getLegacyShipmentsAction(selectedClientId?: string): Promise<LegacyShipment[]> {
  const ctx = await requireUser()
  const clientId = ctx.role === "client" ? ctx.client_id : selectedClientId
  if (!ctx.tenant_id || !clientId) return []
  if (ctx.role !== "client" && ctx.role !== "admin" && ctx.role !== "employee") return []
  const db = createAdminClient()
  const rows: LegacyShipment[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("legacy_shipments").select(COLUMNS)
      .eq("tenant_id", ctx.tenant_id).eq("client_id", clientId)
      .order("shipped_at", { ascending: false }).order("id").range(from, from + 999)
    if (error) throw new Error("Não foi possível carregar o histórico do sistema antigo.")
    rows.push(...((data || []) as LegacyShipment[]))
    if (!data || data.length < 1000) return rows
  }
}
