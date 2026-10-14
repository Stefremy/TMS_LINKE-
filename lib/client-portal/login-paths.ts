import { PORTAL_SECTIONS } from "./paths"

/** Only known, local portal paths may be carried through a login form. */
export function safePortalReturn(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 300) return undefined
  const match = /^\/app(?:\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z-]+))?)?$/.exec(value)
  if (!match) return undefined
  const [, slug, section] = match
  if (slug === "login" || slug === "selecionar") return undefined
  if (section && !PORTAL_SECTIONS.some(s => s === section)) return undefined
  return value
}

export function clientLoginPath(returnTo?: unknown, error = false): string {
  const params = new URLSearchParams()
  const destination = safePortalReturn(returnTo)
  if (destination) params.set("next", destination)
  if (error) params.set("error", "true")
  return `/app/login${params.size ? `?${params}` : ""}`
}
