import type { ShipmentPickagem } from "./types"

export function hasCheckpointLocation(
  checkpoint: ShipmentPickagem
): checkpoint is ShipmentPickagem & { lat: number; lng: number } {
  return typeof checkpoint.lat === "number" && Number.isFinite(checkpoint.lat)
    && typeof checkpoint.lng === "number" && Number.isFinite(checkpoint.lng)
    && Math.abs(checkpoint.lat) <= 90 && Math.abs(checkpoint.lng) <= 180
}

export function getMappedCheckpoints(checkpoints: ShipmentPickagem[]) {
  return checkpoints.filter(hasCheckpointLocation)
}
