import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { findExactZone, isZoneAllowedByService, resolveServiceZoneCode } from "@/lib/pricing/calculate-shipment-price"
import { getServiceDestinationCountries } from "./service-destinations"
import { internationalPostalQuery } from "./geo/international-postal-code"
import { isShipmentDestinationAvailable } from "./shipment-destination-policy"

export type IslandTransportMode = "air" | "sea" | "other"

/** Only the configured API product defines the CTT island mode. Names are editable. */
export function getServiceIslandTransportMode(service: Partial<ServicoLinke>): IslandTransportMode {
  if (service.carrier_group === "correos" || service.preferred_carrier_name?.toLowerCase().includes("correos")) return "other"
  if (service.webservice_service_code) {
    switch (service.webservice_service_code.trim().toUpperCase()) {
      case "EMSF056.01": return "air"
      case "EMSF057.01": return "sea"
      default: return "other"
    }
  }
  return service.island_transport_mode ?? "other"
}

/** Routing readiness, not proof that an address exists. Lookup remains optional. */
export function isDestinationPostalReady(country: string, postal: string): boolean {
  const iso = country.trim().toUpperCase()
  const value = postal.trim()
  if (iso === "PT") return /^\d{4}-?\d{3}$/.test(value)
  if (iso === "ES") return /^(?:0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(value)
  // Lookup supports partial NL/GB/CA queries; shipping readiness must retain full codes.
  if (iso === "NL") return /^\d{4} ?[A-Za-z]{2}$/.test(value)
  if (iso === "IE") return /^[A-Za-z0-9]{3} ?[A-Za-z0-9]{4}$/.test(value)
  if (iso === "MT") return /^[A-Za-z]{3} ?\d{4}$/.test(value)
  if (iso === "PL") return /^\d{2}-?\d{3}$/.test(value)
  if (iso === "LT") return /^(?:LT-)?\d{5}$/i.test(value)
  if (iso === "LV") return /^(?:LV-)?\d{4}$/i.test(value)
  if (["EE", "RO", "GR"].includes(iso)) return (iso === "RO" ? /^\d{6}$/ : /^\d{3} ?\d{2}$/).test(value)
  if (["BE", "AT", "DK", "HU", "SI", "BG", "FR", "DE", "FI", "IT", "CZ", "SK", "SE", "LU"].includes(iso)) return internationalPostalQuery(value, iso) !== null
  return /^[A-Za-z0-9][A-Za-z0-9 -]{2,15}$/.test(value) && /^[A-Z]{2}$/.test(iso)
}

export function isPortugueseIslandDestination(country: string, postal: string): boolean {
  return country.trim().toUpperCase() === "PT" && isDestinationPostalReady(country, postal) && postal.trim().startsWith("9")
}

export function getAuthorizedDestinationCountries(services: ServicoLinke[]) {
  const countries = new Map<string, { code: string; name: string }>()
  for (const service of services) for (const country of getServiceDestinationCountries(service)) countries.set(country.code, country)
  const priority = (iso: string) => iso === "PT" ? 0 : iso === "ES" ? 1 : 2
  return [...countries.values()].sort((a, b) => priority(a.code) - priority(b.code) || a.name.localeCompare(b.name, "pt-PT"))
}

export function getDestinationServiceOptions(services: ServicoLinke[], country: string, postal: string,
  mode?: IslandTransportMode) {
  if (!isDestinationPostalReady(country, postal) || !isShipmentDestinationAvailable(country, postal)) return []
  const islands = isPortugueseIslandDestination(country, postal)
  return services.filter(service => {
    if (service.is_active === false) return false
    if (islands && mode && getServiceIslandTransportMode(service) !== mode) return false
    const zone = resolveServiceZoneCode(service, country, postal)
    if (!zone || !isZoneAllowedByService(service.allowed_zones, zone)) return false
    return findExactZone(service.zones, zone)?.tiers?.some(tier => tier.enabled !== false && Number.isFinite(tier.weight_max) && tier.weight_max > 0) ?? false
  })
}
