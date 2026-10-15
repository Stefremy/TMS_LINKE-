export interface PublicOrigins { portal?: string; ops?: string; site?: string }

function parseOrigin(value: string | undefined, name: string): string | undefined {
  if (!value?.trim()) return undefined
  const url = new URL(value.trim())
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) throw new Error(`${name} deve conter apenas uma origem HTTPS, sem caminhos.`)
  return url.origin
}

/** Public addresses only. Never derive email or callback destinations from an arbitrary Host header. */
export function getPublicOrigins(): PublicOrigins {
  return {
    portal: parseOrigin(process.env.CLIENT_PORTAL_ORIGIN, "CLIENT_PORTAL_ORIGIN"),
    ops: parseOrigin(process.env.OPS_ORIGIN, "OPS_ORIGIN"),
    site: parseOrigin(process.env.PUBLIC_SITE_ORIGIN, "PUBLIC_SITE_ORIGIN"),
  }
}

export function publicUrl(path: string, audience: "portal" | "ops" | "site" = "portal"): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("Caminho público inválido.")
  const origins = getPublicOrigins()
  const origin = origins[audience] || origins.portal || origins.ops || origins.site
    || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined)
  if (!origin) throw new Error("Configure os endereços públicos do projeto antes de gerar links.")
  const url = new URL(path, origin)
  if (url.origin !== origin) throw new Error("Caminho público inválido.")
  return url.toString()
}

/** Keep staff support previews on Ops; client Checkout returns to the client host. */
export function checkoutReturnOrigin(requestOrigin: string | null): string {
  const origins = getPublicOrigins()
  const origin = requestOrigin ? parseOrigin(requestOrigin, "Origem do pagamento") : undefined
  if (origin && (origin === origins.portal || origin === origins.ops)) return origin
  if (origin && process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) return origin
  if (origins.portal) return origins.portal
  // Legacy single-host deployments retain their same-origin return until configured.
  if (origin && !origins.ops && !origins.site) return origin
  throw new Error("Configure CLIENT_PORTAL_ORIGIN antes de iniciar pagamentos.")
}

export function moloniRedirectUri(requestOrigin?: string): string | undefined {
  const opsOrigin = getPublicOrigins().ops || (requestOrigin ? parseOrigin(requestOrigin, "Origem Moloni") : undefined)
  return opsOrigin ? new URL("/api/moloni/callback", opsOrigin).toString() : undefined
}

/** Navigation routing only; authentication and tenant checks remain in server-side access controls. */
export function domainDestination(requestUrl: string, origins: PublicOrigins = getPublicOrigins()): string | undefined {
  const url = new URL(requestUrl)
  const isApp = url.pathname === "/app" || url.pathname.startsWith("/app/")
  const isOps = url.pathname === "/ops" || url.pathname.startsWith("/ops/")
  let origin: string | undefined, path = url.pathname
  if (url.origin === origins.portal && origins.ops && origins.portal !== origins.ops) {
    if (path === "/") path = "/app"
    if (path === "/login") path = "/app/login"
    origin = isOps ? origins.ops : origins.portal
  } else if (url.origin === origins.ops && origins.portal && origins.ops !== origins.portal) {
    if (path === "/") path = "/ops"
    // Staff support previews stay on Ops, with host-only staff/impersonation cookies.
    origin = ["/app/login", "/app/ativar"].includes(path) ? origins.portal : origins.ops
  } else if (url.origin === origins.site && origins.site !== origins.portal && origins.site !== origins.ops) {
    if (path === "/") { origin = origins.portal; path = "/app" }
    else if (isOps || path === "/login") origin = origins.ops
    else if (isApp) origin = origins.portal
  }
  if (!origin) return undefined
  const destination = new URL(origin)
  destination.pathname = path
  destination.search = url.search
  return destination.href === url.href ? undefined : destination.href
}
