"use server"

import { requireEmployee, getTenantId } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { CTTPickupReadService } from "@/lib/services/ctt/ctt-pickup-read.service"
import { mapLocalPickup, normalizePickupObjects, validatePickupSearch, PICKUP_PAGE_SIZE, type PickupSearch, type PickupSummary } from "@/lib/pickup-management"

async function enrich(db: ReturnType<typeof createAdminClient>, tenant: string, rows: Record<string, unknown>[]): Promise<PickupSummary[]> {
  if (!rows.length) return []
  const ids = rows.map(row => String(row.id))
  const refs = rows.map(row => String(row.ctt_pickup_id || "")).filter(Boolean)
  const query = () => db.from("audit_log").select("details,created_at").eq("tenant_id", tenant).eq("action", "recolha_data").order("created_at", { ascending: false }).limit(500)
  const [byId, byRef, confirmations, objectSnapshots] = await Promise.all([
    query().in("details->>recolha_id", ids), refs.length ? query().in("details->>pickup_id", refs) : Promise.resolve({ data: [], error: null }),
    db.from("audit_log").select("details,created_at").eq("tenant_id", tenant).eq("action", "recolha_manual_confirmation").in("details->>recolha_id", ids).order("created_at", { ascending: false }).limit(500),
    db.from("audit_log").select("details,created_at").eq("tenant_id", tenant).eq("action", "recolha_ctt_objects").in("details->>recolha_id", ids).order("created_at", { ascending: false }).limit(500),
  ])
  if (byId.error || byRef.error || confirmations.error || objectSnapshots.error) throw new Error("Não foi possível carregar os detalhes guardados das recolhas.")
  const logs = [...(byId.data || []), ...(byRef.data || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return rows.map(row => {
    const log = logs.find(log => log.details?.recolha_id === row.id || (row.ctt_pickup_id && log.details?.pickup_id === row.ctt_pickup_id))
    const pickup = mapLocalPickup(row, log?.details || {})
    const confirmation = confirmations.data?.find((entry: { details?: { recolha_id?: string; confirmed_at?: string; confirmed_by?: string } }) => entry.details?.recolha_id === row.id)
    if (row.status === "Realizado" && confirmation) pickup.manual_confirmation = {
      confirmed_at: confirmation.details.confirmed_at,
      confirmed_by: confirmation.details.confirmed_by,
    }
    const snapshot = objectSnapshots.data?.find((entry: { details?: { recolha_id?: string; pickup_id?: string } }) => entry.details?.recolha_id === row.id && entry.details?.pickup_id === row.ctt_pickup_id)
    if (snapshot) {
      pickup.objects = normalizePickupObjects(snapshot.details.objects)
      pickup.objects_checked_at = snapshot.details.checked_at
    }
    return pickup
  })
}

/** Read associations from CTT for an owned pickup; never infer them from shipment scans. */
export async function refreshPickupParcelsAction(id: string) {
  await requireEmployee()
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Identificador de recolha inválido.")
    const tenant = await getTenantId(), db = createAdminClient()
    const result = await db.from("recolhas").select("*").eq("tenant_id", tenant).eq("id", id).maybeSingle()
    if (result.error || !result.data) throw new Error("Recolha não encontrada ou sem acesso.")
    const [local] = await enrich(db, tenant, [result.data])
    if (local.carrier_code !== "ctt_expresso" || !local.ctt_pickup_id) throw new Error("Esta recolha não tem uma referência CTT válida para consulta.")
    const creds = await resolveCttCredentials(local.connection_id?.startsWith("default-") ? undefined : local.connection_id)
    const pickup = await new CTTPickupReadService().details(creds, local.ctt_pickup_id)
    if (pickup.ctt_pickup_id.toUpperCase() !== local.ctt_pickup_id.toUpperCase()) throw new Error("A referência devolvida pelos CTT não corresponde à recolha consultada.")
    const collectedAt = pickup.collected_at && Date.parse(pickup.collected_at) > Date.parse("2000-01-01") ? pickup.collected_at : ""
    let localPickup: PickupSummary | undefined
    if (collectedAt && ["Agendado", "pendente"].includes(result.data.status)) {
      const updated = await db.from("recolhas").update({ status: "Realizado" }).eq("tenant_id", tenant).eq("id", id).eq("status", result.data.status).select("*").maybeSingle()
      if (!updated.error && updated.data) {
        await db.from("audit_log").insert({ tenant_id: tenant, action: "recolha_ctt_status_sync", details: {
          recolha_id: id, pickup_id: local.ctt_pickup_id, previous_status: result.data.status, status: "Realizado",
          collected_at: collectedAt, source: "ctt_pesquisa_recolhas",
        } })
        const [synced] = await enrich(db, tenant, [updated.data])
        localPickup = synced
        revalidatePath("/ops/envios/recolhas")
      }
    }
    if (pickup.objects_unavailable_reason) return { success: true as const, pickup, localPickup }
    const objects = normalizePickupObjects(pickup.objects)
    const checkedAt = new Date().toISOString()
    const saved = await db.from("audit_log").insert({ tenant_id: tenant, action: "recolha_ctt_objects", details: {
      recolha_id: local.id, pickup_id: local.ctt_pickup_id, objects, checked_at: checkedAt, source: "ctt_get_recolha",
    } })
    if (saved.error) throw new Error("Os CTT responderam, mas não foi possível guardar a lista de objetos. Tente atualizar novamente.")
    return { success: true as const, pickup: { ...pickup, objects, objects_checked_at: checkedAt }, localPickup }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível atualizar os objetos da recolha." }
  }
}

/** Local operator confirmation only. Does not call CTT or change shipment states. */
export async function markPickupCollectedAction(id: string) {
  const actor = await requireEmployee()
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Identificador de recolha inválido.")
    const tenant = await getTenantId(), db = createAdminClient()
    const result = await db.from("recolhas").select("*").eq("tenant_id", tenant).eq("id", id).maybeSingle()
    if (result.error || !result.data) throw new Error("Recolha não encontrada ou sem acesso.")
    const row = result.data
    if (row.status === "Realizado") {
      const [pickup] = await enrich(db, tenant, [row])
      return { success: true as const, pickup }
    }
    if (!["Agendado", "pendente"].includes(row.status)) throw new Error("Só pode confirmar recolhas agendadas ou pendentes.")
    const [pickup] = await enrich(db, tenant, [row])
    const confirmation = { confirmed_at: new Date().toISOString(), confirmed_by: actor.user.email || actor.user.id }
    const updated = await db.from("recolhas").update({ status: "Realizado" }).eq("tenant_id", tenant).eq("id", id).eq("status", row.status).select("*").maybeSingle()
    if (updated.error || !updated.data) throw new Error("Não foi possível atualizar. A recolha pode ter sido alterada por outro operador; volte a abrir os detalhes.")
    let auditSaved = false
    try {
      const audit = await db.from("audit_log").insert({ tenant_id: tenant, action: "recolha_manual_confirmation", details: {
        recolha_id: id, pickup_id: row.ctt_pickup_id, previous_status: row.status, status: "Realizado",
        source: "manual", user_id: actor.user.id, colaborador_id: actor.colaborador_id,
        ...confirmation,
      } })
      auditSaved = !audit.error
    } catch { /* Restore the previous state below if audit persistence failed. */ }
    if (!auditSaved) {
      const rollback = await db.from("recolhas").update({ status: row.status }).eq("tenant_id", tenant).eq("id", id).eq("status", "Realizado").select("id").maybeSingle()
      revalidatePath("/ops/envios/recolhas")
      throw new Error(rollback.error || !rollback.data
        ? "O estado foi atualizado, mas não foi possível guardar a identificação do operador nem repor o estado anterior. Contacte o administrador antes de repetir."
        : "Não foi possível guardar a confirmação do operador. O estado anterior foi reposto; tente novamente.")
    }
    revalidatePath("/ops/envios/recolhas")
    return { success: true as const, pickup: { ...pickup, status: "Realizado", manual_confirmation: confirmation } }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Falha ao confirmar a recolha." }
  }
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
