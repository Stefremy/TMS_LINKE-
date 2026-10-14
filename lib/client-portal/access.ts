import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { getClientesAction } from "@/app/actions/clientes"
import { buildStoreSlugs, portalPath, type PortalSection } from "./paths"

type StoreIdentity = { id: string; name: string; portal_slug?: string; is_active?: boolean }
type StoreLog = { action: string; details: { id?: string; short_name?: string; legal_name?: string; portal_slug?: string; is_active?: boolean } | null }

const loadStores = cache(async (tenantId: string) => {
  if (!tenantId) throw new Error("Conta sem empresa associada.")
  const db = createAdminClient()
  const stores = new Map<string, StoreIdentity>()
  // Paginate the registry so stores beyond the old display limits remain routable.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("clients").select("id, name").eq("tenant_id", tenantId)
      .order("id").range(offset, offset + 999)
    if (error) throw new Error("Não foi possível verificar a loja. Tente novamente.")
    for (const row of data || []) stores.set(row.id, row)
    if (!data || data.length < 1000) break
  }
  const seen = new Set<string>()
  const deleted = new Set<string>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("audit_log").select("action, details").eq("tenant_id", tenantId)
      .in("action", ["client_data", "deleted_client"]).order("created_at", { ascending: false }).order("id")
      .range(offset, offset + 999)
    if (error) throw new Error("Não foi possível verificar a loja. Tente novamente.")
    for (const row of (data || []) as StoreLog[]) {
      const d = row.details
      if (!d?.id) continue
      if (row.action === "deleted_client") { deleted.add(d.id); continue }
      if (seen.has(d.id)) continue
      const previous = stores.get(d.id)
      stores.set(d.id, { id: d.id, name: d.short_name || d.legal_name || previous?.name || "Loja",
        portal_slug: d.portal_slug, is_active: d.is_active })
      seen.add(d.id)
    }
    if (!data || data.length < 1000) break
  }
  deleted.forEach(id => stores.delete(id))
  const slugs = buildStoreSlugs([...stores.values()])
  return [...stores.values()].map(store => ({ ...store, slug: slugs.get(store.id)! }))
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
