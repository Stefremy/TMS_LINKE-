"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireUser, type AuthContext } from "@/lib/auth/context"
import { PICKUP_REQUEST_PERMISSION, pickupLocationSchema, type PickupLocation } from "@/lib/client-pickup-requests"
import { readPortalAccess } from "@/lib/client-portal/suspension"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "./clientes"

const LOCATION_ACTION = "client_pickup_location"
const DEFAULT_LOCATION_ACTION = "client_pickup_location_default"
const locationId = z.guid().transform(id => id.toLowerCase())

function agendaScope(ctx: AuthContext, selectedClientId?: string) {
  const clientId = ctx.role === "client" ? ctx.client_id : selectedClientId
  if (!ctx.tenant_id || !clientId) throw new Error("Selecione uma conta válida para a agenda de recolhas.")
  return { tenantId: ctx.tenant_id, clientId }
}

type AgendaScope = ReturnType<typeof agendaScope>
type Database = ReturnType<typeof createAdminClient>

async function assertAgendaWritable(db: Database, { tenantId, clientId }: AgendaScope) {
  const [access, clients, owner] = await Promise.all([
    readPortalAccess(tenantId, clientId),
    getClientesAction(clientId),
    db.from("clients").select("id").eq("tenant_id", tenantId).eq("id", clientId).maybeSingle(),
  ])
  const client = clients.find(row => row.id === clientId)
  if (owner.error || !owner.data || !client || client.is_active === false || access.blocked || access.suspended) {
    throw new Error("Esta conta não pode alterar a agenda de recolhas.")
  }
}

function locationsQuery(db: Database, { tenantId, clientId }: AgendaScope) {
  return db.from("audit_log").select("id,details,created_at").eq("tenant_id", tenantId)
    .eq("action", LOCATION_ACTION).eq("details->>client_id", clientId)
}

function defaultPreferenceId({ tenantId, clientId }: AgendaScope) {
  const hash = createHash("sha256").update(`${DEFAULT_LOCATION_ACTION}:${tenantId}:${clientId}`).digest("hex")
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

async function readLocations(db: Database, scope: AgendaScope) {
  const entries: { location: PickupLocation; createdAt: string }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await locationsQuery(db, scope)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999)
    if (error || !data) throw new Error("A agenda não está disponível.")
    for (const row of data) {
      entries.push({ location: { ...pickupLocationSchema.parse(row.details?.location), id: row.id }, createdAt: row.created_at })
    }
    if (data.length < 1000) return entries
  }
}

export async function listClientPickupLocationsAction(selectedClientId?: string) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  try {
    const scope = agendaScope(ctx, selectedClientId)
    const db = createAdminClient()
    const [entries, preference] = await Promise.all([
      readLocations(db, scope),
      db.from("audit_log").select("details").eq("tenant_id", scope.tenantId).eq("action", DEFAULT_LOCATION_ACTION)
        .eq("details->>client_id", scope.clientId).eq("id", defaultPreferenceId(scope)).maybeSingle(),
    ])
    if (preference.error) throw new Error("O local padrão não está disponível.")
    const settings = preference.data?.details
    const defaultLocation = entries.find(({ location, createdAt }) =>
      location.id === settings?.location_id && createdAt === settings?.location_created_at)
    return { success: true as const, locations: entries.map(entry => entry.location), defaultLocationId: defaultLocation?.location.id ?? null }
  } catch {
    return { success: false as const, error: "Não foi possível carregar a agenda de recolhas. Atualize a página para tentar novamente." }
  }
}

export async function setDefaultClientPickupLocationAction(id: string | null, selectedClientId?: string) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  const parsedId = locationId.nullable().safeParse(id)
  if (!parsedId.success) return { success: false as const, error: "Local de recolha inválido." }
  try {
    const scope = agendaScope(ctx, selectedClientId)
    const db = createAdminClient()
    await assertAgendaWritable(db, scope)
    const selectedId = parsedId.data
    let createdAt: string | null = null
    if (selectedId) {
      const { data, error } = await locationsQuery(db, scope).eq("id", selectedId).maybeSingle()
      if (error || !data) return { success: false as const, error: "Este local já não está disponível na agenda." }
      createdAt = data.created_at
    }

    // One preference per store. Only a matching record may be updated, including after an insert race.
    const preferenceId = defaultPreferenceId(scope)
    const details = { client_id: scope.clientId, location_id: selectedId, location_created_at: createdAt }
    const update = () => db.from("audit_log").update({ details }).eq("tenant_id", scope.tenantId)
      .eq("action", DEFAULT_LOCATION_ACTION).eq("details->>client_id", scope.clientId).eq("id", preferenceId).select("id").maybeSingle()
    const existing = await update()
    if (existing.error) throw existing.error
    if (!existing.data) {
      const { error } = await db.from("audit_log").insert({ id: preferenceId, tenant_id: scope.tenantId, action: DEFAULT_LOCATION_ACTION, details })
      if (error) {
        if (error.code !== "23505") throw error
        const retry = await update()
        if (retry.error || !retry.data) throw new Error("Preference record unavailable")
      }
    }
    revalidatePath("/app/[storeSlug]/recolhas", "page")
    return { success: true as const, defaultLocationId: selectedId }
  } catch {
    return { success: false as const, error: "Não foi possível guardar o local padrão de recolha." }
  }
}

export async function saveClientPickupLocationAction(input: unknown, id: string, mode: "create" | "edit", selectedClientId?: string) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  const parsed = pickupLocationSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message }
  const parsedId = locationId.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: "Local de recolha inválido." }

  try {
    const scope = agendaScope(ctx, selectedClientId)
    const db = createAdminClient()
    await assertAgendaWritable(db, scope)
    const location = parsed.data
    const id = parsedId.data
    const details = { client_id: scope.clientId, location }
    if (mode === "edit") {
      const { data, error } = await db.from("audit_log").update({ details }).eq("tenant_id", scope.tenantId)
        .eq("action", LOCATION_ACTION).eq("details->>client_id", scope.clientId).eq("id", id).select("id").maybeSingle()
      if (error || !data) return { success: false as const, error: "Não foi possível alterar este local. Atualize a agenda e tente novamente." }
    } else if (mode === "create") {
      const { error } = await db.from("audit_log").insert({ id, tenant_id: scope.tenantId, action: LOCATION_ACTION, details })
      if (error) {
        // A retry after an interrupted response can reuse the same saved location.
        if (error.code !== "23505") throw new Error("Location insert failed")
        const existing = await locationsQuery(db, scope).eq("id", id).maybeSingle()
        const saved = pickupLocationSchema.safeParse(existing.data?.details?.location)
        if (existing.error || !saved.success || Object.keys(location).some(key => {
          const field = key as keyof typeof location
          return location[field] !== saved.data[field]
        })) throw new Error("Location ID already in use")
      }
    } else {
      return { success: false as const, error: "Operação inválida." }
    }

    revalidatePath("/app/[storeSlug]/recolhas", "page")
    return { success: true as const, location: { ...location, id } }
  } catch {
    return { success: false as const, error: "Não foi possível guardar o local de recolha." }
  }
}

export async function deleteClientPickupLocationAction(id: string, selectedClientId?: string) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  const parsedId = locationId.safeParse(id)
  if (!parsedId.success) return { success: false as const, error: "Local de recolha inválido." }
  try {
    const scope = agendaScope(ctx, selectedClientId)
    const db = createAdminClient()
    await assertAgendaWritable(db, scope)
    const { error } = await db.from("audit_log").delete().eq("tenant_id", scope.tenantId)
      .eq("action", LOCATION_ACTION).eq("details->>client_id", scope.clientId).eq("id", parsedId.data)
    if (error) throw new Error("Location delete failed")
    revalidatePath("/app/[storeSlug]/recolhas", "page")
    return { success: true as const }
  } catch {
    return { success: false as const, error: "Não foi possível remover o local de recolha." }
  }
}
