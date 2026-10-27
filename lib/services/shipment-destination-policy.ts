import { requiresCttCustoms } from "./ctt/customs-declaration"
import { ShipmentPricingError } from "@/lib/pricing/shipment-pricing-errors"

// Temporary business policy. Keep customs forms, validation and SOAP support intact.
export const CUSTOMS_DESTINATIONS_ENABLED = false

export function isShipmentDestinationAvailable(country: string, postalCode = ""): boolean {
  if (!country.trim()) return false
  return CUSTOMS_DESTINATIONS_ENABLED || !requiresCttCustoms(country, postalCode || "")
}

export function assertShipmentDestinationAvailable(country: string, postalCode = ""): void {
  if (!isShipmentDestinationAvailable(country, postalCode)) {
    throw new ShipmentPricingError("Os envios para destinos sujeitos a procedimentos aduaneiros estão temporariamente indisponíveis. Selecione outro destino.")
  }
}
