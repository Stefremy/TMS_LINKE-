import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

/**
 * Outbound requests to a client's web store. The store address is typed by the client, so the
 * server must never be usable to reach its own network: only public HTTPS addresses are allowed,
 * checked again on every redirect, and secrets are not forwarded to another origin.
 */
export class StoreUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StoreUrlError"
  }
}

const SECRET_HEADERS = ["authorization", "x-shopify-access-token", "cookie"]
const MAX_REDIRECTS = 3

function ipv4Parts(ip: string) {
  const parts = ip.split(".").map(Number)
  return parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null
}

/** Loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isNonPublicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  const v4 = ipv4Parts(ip)
  if (v4) {
    const [a, b] = v4
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && v4[2] === 0) || (a === 198 && (b === 18 || b === 19))
  }
  if (isIP(ip) !== 6) return true
  // IPv4-mapped addresses, in dotted (::ffff:10.0.0.1) or hex (::ffff:a00:1, as URL parsing writes them) form.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isNonPublicAddress(mapped[1])
  const hexMapped = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMapped) {
    const [high, low] = [parseInt(hexMapped[1], 16), parseInt(hexMapped[2], 16)]
    return isNonPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff") || ip.startsWith("64:ff9b:")
}

/** Throws StoreUrlError unless `raw` is an https URL whose host resolves only to public addresses. */
export async function assertPublicStoreUrl(raw: string): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new StoreUrlError("O endereço da loja não é válido.") }
  if (url.protocol !== "https:") throw new StoreUrlError("O endereço da loja tem de começar por https://.")
  if (url.username || url.password) throw new StoreUrlError("O endereço da loja não pode conter utilizador ou palavra-passe.")
  if (url.port && url.port !== "443") throw new StoreUrlError("O endereço da loja tem de usar a porta HTTPS normal.")
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || (!isIP(host) && !host.includes("."))) {
    throw new StoreUrlError("O endereço da loja não é um endereço público.")
  }
  let addresses: string[]
  if (isIP(host)) addresses = [host]
  else {
    try { addresses = (await lookup(host, { all: true, verbatim: true })).map(entry => entry.address) }
    catch { throw new StoreUrlError(`Não foi possível encontrar o endereço ${host}.`) }
  }
  if (!addresses.length || addresses.some(isNonPublicAddress)) throw new StoreUrlError("O endereço da loja não é um endereço público.")
  return url
}

/**
 * fetch() for store APIs. Redirects are followed by hand so each hop is validated; like browsers,
 * credentials headers are dropped when a redirect leaves the original origin.
 */
export async function storeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let url = await assertPublicStoreUrl(input)
  let method = (init.method || "GET").toUpperCase()
  let body = init.body
  const headers = new Headers(init.headers)
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, { ...init, method, body, headers, redirect: "manual" })
    const location = response.headers.get("location")
    if (response.status < 300 || response.status >= 400 || response.status === 304 || !location) return response
    if (hop >= MAX_REDIRECTS) throw new StoreUrlError("A loja redirecionou demasiadas vezes.")
    const next = await assertPublicStoreUrl(new URL(location, url).toString())
    if (next.origin !== url.origin) SECRET_HEADERS.forEach(name => headers.delete(name))
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
      if (method !== "HEAD") method = "GET"
      body = undefined
      headers.delete("content-type")
    }
    url = next
  }
}
