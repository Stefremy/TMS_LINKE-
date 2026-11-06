import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { findExactZone, isZoneAllowedByService, resolveServiceZoneCode } from "@/lib/pricing/calculate-shipment-price"
import { COUNTRY_TO_ZONE_MAP, CTT_CE_TRUCK_ZONES } from "./geo/international-zones"
import { isShipmentDestinationAvailable } from "./shipment-destination-policy"
import { detectCarrierGroup } from "@/lib/pricing/carrier-zone-templates"
import { requiresCorreosQuotation } from "./correos/shipment-policy"
import { canRequestCorreosQuotation } from "./correos/quotation-pricing"
import { countryNamePt, compareCountryNames } from "@/lib/i18n/countries"

export { resolveServiceZoneCode as getServiceDestinationZone } from "@/lib/pricing/calculate-shipment-price"

const countryCodes = [...new Set([
  "PT", "ES",
  ...Object.keys(COUNTRY_TO_ZONE_MAP).map(code => code.replace(/_ISO$/, "")),
  ...Object.values(CTT_CE_TRUCK_ZONES).flatMap(zone => zone.countries),
].filter(code => /^[A-Z]{2}$/.test(code)).map(code => code === "UK" ? "GB" : code))]

/** Published automatic coverage, plus destinations eligible for a non-binding Correos quotation. */
export function getServiceDestinationCountries(service?: ServicoLinke | null): { code: string; name: string }[] {
  if (!service || service.is_active === false) return []
  const activeService = service
  return countryCodes.filter(country => {
    // A country remains selectable for an islands-only service; postal validation refines coverage.
    const postals = country === "PT" ? ["", "9000-001"]
      : country === "ES" ? ["", "07001", "07701", "07800", "35001", "38001", "51001", "52001"] : [""]
    return postals.some(postal => {
      const manualQuote = requiresCorreosQuotation(detectCarrierGroup(activeService) || "", country, activeService)
      if (manualQuote) return canRequestCorreosQuotation(activeService, country)
      if (!manualQuote && !isShipmentDestinationAvailable(country, postal)) return false
      const zoneCode = resolveServiceZoneCode(activeService, country, postal)
      if (!zoneCode || !isZoneAllowedByService(activeService.allowed_zones, zoneCode)) return false
      return findExactZone(activeService.zones, zoneCode)?.tiers?.some(tier =>
        tier.enabled !== false && Number.isFinite(tier.weight_max) && tier.weight_max > 0) ?? false
    })
  }).map(code => ({ code, name: countryNamePt(code) }))
    .sort((a, b) => {
      const priority = (code: string) => code === "PT" ? 0 : code === "ES" ? 1 : 2
      return priority(a.code) - priority(b.code) || compareCountryNames(a, b)
    })
}
