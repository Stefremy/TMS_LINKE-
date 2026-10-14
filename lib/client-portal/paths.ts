export const PORTAL_SECTIONS = ["criar-guia", "destinatarios", "envios", "faturas", "recolhas"] as const
export type PortalSection = typeof PORTAL_SECTIONS[number]
const RESERVED = new Set<string>([...PORTAL_SECTIONS, "selecionar", "login", "ativar"])

export function normalizeStoreSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-$/g, "") || "loja"
}

type StoreIdentity = { id: string; name: string; portal_slug?: string }

/** Duplicate/reserved names receive the immutable ID; ambiguous names never pick a store. */
export function buildStoreSlugs(stores: StoreIdentity[]): Map<string, string> {
  const candidates = stores.map(store => ({ id: store.id, slug: normalizeStoreSlug(store.portal_slug || store.name) }))
  const counts = new Map<string, number>()
  candidates.forEach(({ slug }) => counts.set(slug, (counts.get(slug) || 0) + 1))
  const result = new Map<string, string>()
  candidates.forEach(({ id, slug }) => {
    result.set(id, RESERVED.has(slug) || counts.get(slug)! > 1 ? `${slug}-${id}` : slug)
  })
  // A supplied alias may coincide with a generated suffix. Disambiguate all such entries.
  for (;;) {
    const finalCounts = new Map<string, number>()
    result.forEach(slug => finalCounts.set(slug, (finalCounts.get(slug) || 0) + 1))
    const collisions = [...result].filter(([, slug]) => finalCounts.get(slug)! > 1)
    if (!collisions.length) break
    collisions.forEach(([id]) => result.set(id, `loja-${id}`))
  }
  return result
}

export function portalPath(slug: string, section?: PortalSection): string {
  return `/app/${encodeURIComponent(slug)}${section ? `/${section}` : ""}`
}
