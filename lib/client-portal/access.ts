import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { buildStoreSlugs, portalPath, type PortalSection } from "./paths"

type StoreIdentity = { id: string; name: string; portal_slug?: string; is_active?: boolean }
type StoreLog = { action: string; store_id?: string; short_name?: string; legal_name?: string; portal_slug?: string; is_active?: boolean }

let storesMemoryCache: { tenantId: string; timestamp: number; data: (StoreIdentity & { slug: string })[] } | null = null

export function clearStoresMemoryCache() {
  storesMemoryCache = null
}

const loadStores = cache(async (tenantId: string) => {
  if (!tenantId) throw new Error("Conta sem empresa associada.")

  // 30-second memory cache avoids re-querying clients and audit_log on every page transition in the portal
  if (storesMemoryCache && storesMemoryCache.tenantId === tenantId && (Date.now() - storesMemoryCache.timestamp) < 30_000) {
    return storesMemoryCache.data
  }

  const db = createAdminClient()
  // Paginate the registry so stores beyond the old display limits remain routable.
  const readRegistry = async () => {
    const rows: StoreIdentity[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("clients").select("id, name").eq("tenant_id", tenantId)
        .order("id").range(offset, offset + 999)
      if (error) throw new Error("Não foi possível verificar a loja. Tente novamente.")
      rows.push(...(data || []))
      if (!data || data.length < 1000) return rows
    }
  }
  const readIdentities = async () => {
    const rows: StoreLog[] = []
    for (let offset = 0; ; offset += 1000) {
      // Slug checks need identity fields only, never avatars, prices or balances.
      const { data, error } = await db.from("audit_log")
        .select("action,store_id:details->>id,short_name:details->>short_name,legal_name:details->>legal_name,portal_slug:details->>portal_slug,is_active:details->is_active")
        .eq("tenant_id", tenantId).in("action", ["client_data", "deleted_client"])
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999)
      if (error) throw new Error("Não foi possível verificar a loja. Tente novamente.")
      rows.push(...(data || []) as StoreLog[])
      if (!data || data.length < 1000) return rows
    }
  }
  const [registry, identities] = await Promise.all([readRegistry(), readIdentities()])
  const stores = new Map(registry.map(row => [row.id, row]))
  const seen = new Set<string>()
  const deleted = new Set<string>()
  for (const row of identities) {
    const id = row.store_id
    if (!id) continue
    if (row.action === "deleted_client") { deleted.add(id); continue }
    if (seen.has(id)) continue
    const previous = stores.get(id)
    stores.set(id, { id, name: row.short_name || row.legal_name || previous?.name || "Loja",
      portal_slug: row.portal_slug, is_active: row.is_active })
    seen.add(id)
  }
  deleted.forEach(id => stores.delete(id))
  const slugs = buildStoreSlugs([...stores.values()])
  const result = [...stores.values()].map(store => ({ ...store, slug: slugs.get(store.id)! }))
  storesMemoryCache = { tenantId, timestamp: Date.now(), data: result }
  return result
})

export const requirePortalStore = cache(async (slug: string) => {
  const ctx = await requireUser()
  const stores = await loadStores(ctx.tenant_id)
  const matches = stores.filter(store => store.slug === slug)
  const store = matches.length === 1 ? matches[0] : undefined
  if (!store || (ctx.role === "client" && (ctx.client_id !== store.id || store.is_active === false))) notFound()
  if (ctx.role !== "client" && ctx.role !== "employee" && ctx.role !== "admin") notFound()
  const client = (await getClientesAction(store.id)).find(c => c.id === store.id)
  if (!client) notFound()
  return { client, slug: store.slug, basePath: portalPath(store.slug), isEmployee: ctx.role !== "client" }
})

export async function getPortalDestination(clientId: string): Promise<string> {
  const ctx = await requireUser()
  if (ctx.role !== "client" && ctx.role !== "employee" && ctx.role !== "admin") notFound()
  const store = (await loadStores(ctx.tenant_id)).find(s => s.id === clientId)
  if (!store || (ctx.role === "client" && (ctx.client_id !== clientId || store.is_active === false))) notFound()
  return portalPath(store.slug)
}

export async function redirectLegacyPortal(
  section?: PortalSection,
  searchParams: Record<string, string | string[] | undefined> = {}
) {
  const ctx = await requireUser()
  if (!ctx.client_id) redirect("/ops/entidades/clientes")
  const base = await getPortalDestination(ctx.client_id)
  const query = new URLSearchParams()
  if (typeof searchParams.topup === "string" && ["success", "cancelled"].includes(searchParams.topup)) query.set("topup", searchParams.topup)
  redirect(`${base}${section ? `/${section}` : ""}${query.size ? `?${query}` : ""}`)
}
