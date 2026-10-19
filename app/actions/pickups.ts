"use server"

import { requireEmployee, getTenantId } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { CTTPickupReadService } from "@/lib/services/ctt/ctt-pickup-read.service"
import { mapLocalPickup, validatePickupSearch, PICKUP_PAGE_SIZE, type PickupSearch, type PickupSummary } from "@/lib/pickup-management"

async function enrich(db: ReturnType<typeof createAdminClient>, tenant: string, rows: Record<string, unknown>[]): Promise<PickupSummary[]> {
  if (!rows.length) return []
  const ids = rows.map(row => String(row.id))
  const refs = rows.map(row => String(row.ctt_pickup_id || "")).filter(Boolean)
  const query = () => db.from("audit_log").select("details,created_at").eq("tenant_id", tenant).eq("action", "recolha_data").order("created_at", { ascending: false }).limit(500)
  const [byId, byRef] = await Promise.all([
    query().in("details->>recolha_id", ids), refs.length ? query().in("details->>pickup_id", refs) : Promise.resolve({ data: [], error: null }),
  ])
  if (byId.error || byRef.error) throw new Error("Não foi possível carregar os detalhes guardados das recolhas.")
  const logs = [...(byId.data || []), ...(byRef.data || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return rows.map(row => {
    const log = logs.find(log => log.details?.recolha_id === row.id || (row.ctt_pickup_id && log.details?.pickup_id === row.ctt_pickup_id))
    return mapLocalPickup(row, log?.details || {})
  })
}

export async function searchPickupsAction(input: PickupSearch = {}) {
  await requireEmployee()
  try {
    const error = validatePickupSearch(input)
    if (error) return { success: false as const, error }
    const tenant = await getTenantId(), db = createAdminClient()
    const page = input.page || 0
    let query = db.from("recolhas").select("*", { count: "exact" }).eq("tenant_id", tenant)
    if (input.dateFrom) query = query.gte("scheduled_date", input.dateFrom).lte("scheduled_date", input.dateTo!)
    if (input.reference?.trim()) query = query.ilike("ctt_pickup_id", `%${input.reference.trim().replace(/[\\%_]/g, "\\$&")}%`)
    if (input.status) query = query.eq("status", input.status)
    const result = await query.order("scheduled_date", { ascending: false }).order("created_at", { ascending: false }).range(page * PICKUP_PAGE_SIZE, (page + 1) * PICKUP_PAGE_SIZE - 1)
    if (result.error) throw new Error("Não foi possível pesquisar as recolhas guardadas.")
    return { success: true as const, pickups: await enrich(db, tenant, result.data || []), total: result.count || 0, page }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Falha ao pesquisar recolhas." }
  }
}

export async function getPickupDetailsAction(id: string) {
  await requireEmployee()
  try {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Identificador de recolha inválido.")
    const tenant = await getTenantId(), db = createAdminClient()
    const result = await db.from("recolhas").select("*").eq("tenant_id", tenant).eq("id", id).maybeSingle()
    if (result.error || !result.data) throw new Error("Recolha não encontrada ou sem acesso.")
    const [pickup] = await enrich(db, tenant, [result.data])
    return { success: true as const, pickup }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Falha ao abrir a recolha." }
  }
}

export async function searchCttPickupsAction(input: PickupSearch) {
  await requireEmployee()
  try {
    const error = validatePickupSearch(input, true)
    if (error) throw new Error(error)
    const creds = await resolveCttCredentials(input.connectionId)
    const pickups = await new CTTPickupReadService().search(creds, input)
    return { success: true as const, pickups, total: pickups.length, page: 0 }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Falha ao consultar os CTT." }
  }
}

export async function getCttPickupDetailsAction(reference: string, connectionId?: string) {
  await requireEmployee()
  try {
    const creds = await resolveCttCredentials(connectionId)
    const pickup = await new CTTPickupReadService().details(creds, reference)
    return { success: true as const, pickup }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Falha ao consultar os CTT." }
  }
}
