import type { GeoCoordinate } from "@/lib/services/geo/coordinates"
import { hasCheckpointLocation } from "./map-points"
import type { ShipmentPickagem } from "./types"

type Coordinate = Pick<GeoCoordinate, "lat" | "lng"> & { district?: string }

function isLocated(point: Coordinate) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
    // The geocoder uses country centres when it cannot resolve a location.
    && !(point.lat === 39.5 && point.lng === -8.5)
    && point.district !== "Espanha"
}

// Great-circle distance; this does not require a road-routing service.
export function distanceKm(from: Coordinate, to: Coordinate): number | null {
  if (!isLocated(from) || !isLocated(to)) return null
  const radians = (degrees: number) => degrees * Math.PI / 180
  const deltaLat = radians(to.lat - from.lat)
  const deltaLng = radians(to.lng - from.lng)
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

export function buildTrackingDistances(
  origin: Coordinate,
  destination: Coordinate,
  checkpoints: ShipmentPickagem[],
  delivered: boolean,
) {
  const latestLocated = [...checkpoints].reverse().find(point =>
    point.status !== "pending" && hasCheckpointLocation(point)
      && isLocated({ lat: point.lat, lng: point.lng }),
  )
  const current = latestLocated && hasCheckpointLocation(latestLocated) ? latestLocated : origin
  return {
    totalDistanceKm: distanceKm(origin, destination),
    remainingDistanceKm: delivered ? 0 : distanceKm(current, destination),
  }
}
