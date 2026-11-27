import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/context"
import { resolveCoordinates } from "@/lib/services/geo/geocoder"

export const runtime = "nodejs"

const MAX_PLACES = 10

/** Locate tracking checkpoints after the page has opened. Signed-in users only; few places per call (OSM policy). */
export async function POST(request: Request) {
  await requireUser()
  const body = await request.json().catch(() => null) as { places?: unknown } | null
  const input = Array.isArray(body?.places) ? body.places : []
  const places = input.slice(0, MAX_PLACES).filter((p): p is { city: string; country: string } =>
    !!p && typeof p === "object" && typeof (p as { city?: unknown }).city === "string" && typeof (p as { country?: unknown }).country === "string"
    && (p as { city: string }).city.trim().length > 0 && (p as { city: string }).city.length <= 120 && (p as { country: string }).country.length <= 2)
  if (!places.length) return NextResponse.json({ error: "Indique os locais a localizar." }, { status: 400 })
  // Sequential on purpose: the geocoder rate-limits the external service to 1 request per second.
  const results = []
  for (const place of places) {
    const coord = await resolveCoordinates({ city: place.city.trim(), country: place.country, useApi: true })
    const found = Number.isFinite(coord.lat) && Number.isFinite(coord.lng) && !(coord.lat === 39.5 && coord.lng === -8.5)
    results.push({ ...place, coordinate: found ? { lat: coord.lat, lng: coord.lng, name: coord.name, district: coord.district } : null })
  }
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } })
}
