/**
 * Smart Geocoder for TMS Linke
 *
 * Resolution chain (best precision first):
 *  1. In-memory cache (instant)
 *  2. Known CTT hubs / C.O. lookup table (static, ~100m precision)
 *  3. Postal code DB (SQLite, ~1km precision per 4+3 code)
 *  4. Nominatim / OpenStreetMap API (real address, ~10m precision)
 *  5. Postal-prefix region fallback
 *  6. Country center default
 */

import { resolveLocationCoordinate, GeoCoordinate } from "./coordinates"
import { lookupPostalCode } from "./postal-code.service"

// In-memory cache: TTL 24h
const geocodeCache = new Map<string, { coord: GeoCoordinate; ts: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000

function fromCache(key: string): GeoCoordinate | null {
  const entry = geocodeCache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.coord
  return null
}
function toCache(key: string, coord: GeoCoordinate) {
  geocodeCache.set(key, { coord, ts: Date.now() })
}

// Nominatim rate-limiter: 1 req/s (OSM policy)
let lastNominatimCall = 0

async function nominatimGeocode(
  query: string,
  countryCode = "pt"
): Promise<GeoCoordinate | null> {
  const now = Date.now()
  const wait = 1100 - (now - lastNominatimCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastNominatimCall = Date.now()

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=${countryCode}`
    const res = await fetch(url, {
      headers: { "User-Agent": "TMS-Linke/1.0 (logistics@linke.pt)" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length === 0) return null
    const hit = data[0]
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      name: hit.display_name?.split(",")[0]?.trim() || query,
      district: hit.display_name?.split(",")[1]?.trim(),
    }
  } catch {
    return null
  }
}

export interface GeoResolveInput {
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: "PT" | "ES" | string
  useApi?: boolean
}

function isGeneric(coord: GeoCoordinate) {
  return coord.lat === 39.5 && coord.lng === -8.5
}

export async function resolveCoordinates(
  input: GeoResolveInput
): Promise<GeoCoordinate> {
  const { address, city, postalCode, country = "PT", useApi = true } = input
  const cacheKey = [address, city, postalCode].filter(Boolean).join("|").toLowerCase()

  // 1. Cache
  if (cacheKey) {
    const cached = fromCache(cacheKey)
    if (cached) return cached
  }

  // 2. Static hub/CO table (exact or known facility/city match from name alone)
  for (const q of [address, city]) {
    if (!q) continue
    const r = resolveLocationCoordinate(q, null)
    if (!isGeneric(r)) {
      if (cacheKey) toCache(cacheKey, r)
      return r
    }
  }

  // 3. Postal code DB (SQLite) → locality / concelho / distrito
  if (postalCode) {
    const pcResult = lookupPostalCode(postalCode, country)
    if (pcResult?.found) {
      const candidates = [pcResult.city, pcResult.municipality, pcResult.district].filter(Boolean) as string[]
      for (const loc of candidates) {
        const r = resolveLocationCoordinate(loc, null)
        if (!isGeneric(r)) {
          const enriched: GeoCoordinate = {
            ...r,
            name: pcResult.city || r.name,
            district: pcResult.district || r.district,
          }
          if (cacheKey) toCache(cacheKey, enriched)
          return enriched
        }
      }

      // If concelho/district wasn't in static table, try Nominatim if API allowed
      if (useApi) {
        const q = [pcResult.street, pcResult.city, pcResult.municipality, pcResult.district].filter(Boolean).join(", ")
        const apiR = await nominatimGeocode(q, country.toLowerCase())
        if (apiR) {
          apiR.district = apiR.district || pcResult.district
          if (cacheKey) toCache(cacheKey, apiR)
          return apiR
        }
      }
    }
  }

  // 4. Nominatim with full address
  if (useApi && (address || city)) {
    const q = [address, city].filter(Boolean).join(", ") + ", Portugal"
    const apiR = await nominatimGeocode(q, country.toLowerCase())
    if (apiR) {
      if (cacheKey) toCache(cacheKey, apiR)
      return apiR
    }
  }

  // 5. Postal prefix fallback
  if (postalCode) {
    const r = resolveLocationCoordinate(null, postalCode)
    if (!isGeneric(r)) {
      if (cacheKey) toCache(cacheKey, r)
      return r
    }
  }

  // 6. Country default
  return country === "ES"
    ? { lat: 40.416, lng: -3.703, name: city || "Espanha", district: "Espanha" }
    : { lat: 39.5, lng: -8.5, name: city || "Portugal", district: "Portugal" }
}
