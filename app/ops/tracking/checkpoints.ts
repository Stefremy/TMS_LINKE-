import { resolveCoordinates } from "@/lib/services/geo/geocoder"
import { resolveLocationCoordinate, type GeoCoordinate } from "@/lib/services/geo/coordinates"
import type { ShipmentPickagem } from "./types"

export interface TrackingEventInput {
  id?: string
  event_code?: string | null
  location_name?: string | null
  description?: string | null
  timestamp?: string | null
  created_at?: string | null
}

// Keep nested facility suffixes such as "C.O. BRAGA (OBR)" intact.
function trailingFacility(description: string): string {
  const text = description.trim()
  if (!text.endsWith(")")) return ""
  let depth = 0
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ")") depth++
    if (text[i] === "(" && --depth === 0) return text.slice(i + 1, -1).trim()
  }
  return ""
}

function isGenericClientNode(location: string) {
  const normalized = location.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return /^(?:chegada ao )?no (?:de )?cliente(?: no (?:de )?cliente)?$/.test(normalized)
}

function isResolved(coordinate: GeoCoordinate) {
  return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)
    && !(coordinate.lat === 39.5 && coordinate.lng === -8.5)
}

export async function buildTrackingCheckpoints(
  events: TrackingEventInput[],
  options: { destination: GeoCoordinate; delivered: boolean; country: string }
): Promise<ShipmentPickagem[]> {
  const checkpoints: ShipmentPickagem[] = []
  for (const [index, event] of events.entries()) {
    const description = event.description?.trim() || ""
    const location = event.location_name?.trim() || trailingFacility(description)
    const isDelivery = event.event_code === "EMI"
      || /^(?:(?:objeto|envio|encomenda) )?(?:entregue|entrega conseguida)\b/i.test(description)
    let coordinate: GeoCoordinate | null = null

    if (isDelivery) {
      if (isResolved(options.destination)) coordinate = options.destination
    } else if (location && !isGenericClientNode(location)) {
      // Resolve the full facility first. Extracting only the last parentheses
      // would search for "OBR" instead of the explicitly named Braga centre.
      const known = resolveLocationCoordinate(location)
      const resolved = isResolved(known) ? known : await resolveCoordinates({
        city: location, country: options.country, useApi: true,
      })
      if (isResolved(resolved)) coordinate = resolved
    }

    const timestamp = event.timestamp || event.created_at || ""
    const date = timestamp ? new Date(timestamp) : null
    const isLast = index === events.length - 1
    checkpoints.push({
      id: `pick-${event.id || index}`,
      code: event.event_code || "TRN",
      title: description || "Passagem em Ponto de Controlo",
      locationName: coordinate?.name || location || "Local não indicado",
      city: coordinate?.district || "Local não indicado",
      lat: coordinate?.lat ?? null,
      lng: coordinate?.lng ?? null,
      timestamp,
      formattedTime: date && Number.isFinite(date.getTime())
        ? date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })
        : "—",
      status: isLast && !options.delivered ? "current" : "completed",
      isCurrentPosition: isLast,
      description,
    })
  }
  return checkpoints
}
