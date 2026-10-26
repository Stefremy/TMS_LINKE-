import { COUNTRY_TO_ZONE_MAP, CTT_CE_TRUCK_ZONES, OFFICIAL_LINKE_ZONES } from "./international-zones"

export interface DistributionCountry { code: string; name: string }
export interface DistributionZone { code: string; name: string; countries: DistributionCountry[] }
export interface DistributionZoneGroup {
  id: "ctt_road" | "correos_international"
  carrier: string
  service: string
  description: string
  zones: DistributionZone[]
}

const countryNames = new Intl.DisplayNames(["pt-PT"], { type: "region" })
function countriesFromCodes(codes: string[]): DistributionCountry[] {
  return [...new Set(codes.filter(code => /^[A-Z]{2}$/.test(code)).map(code => code === "UK" ? "GB" : code))]
    .map(code => ({ code, name: countryNames.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"))
}

/** Display the same road and air country mappings used by shipment pricing. */
export function getDistributionZoneGroups(): DistributionZoneGroup[] {
  const internationalCountries = Object.entries(COUNTRY_TO_ZONE_MAP)
    .map(([code, zone]) => ({ code: code.replace(/_ISO$/, ""), zone }))
  return [
    {
      id: "ctt_road", carrier: "CTT Expresso", service: "Europa Terrestre · Guia CE",
      description: "Duas zonas de distribuição para envios europeus por via terrestre.",
      zones: Object.values(CTT_CE_TRUCK_ZONES).map(zone => ({
        code: zone.code, name: "Europa Rodoviário", countries: countriesFromCodes(zone.countries),
      })),
    },
    {
      id: "correos_international", carrier: "Correos Express", service: "Internacional · Exportação Aérea",
      description: "Oito zonas da tabela internacional, com os países e territórios abrangidos.",
      zones: Object.values(OFFICIAL_LINKE_ZONES).map(zone => ({
        code: zone.code, name: zone.name,
        countries: countriesFromCodes(internationalCountries.filter(country => country.zone === zone.code).map(country => country.code)),
      })),
    },
  ]
}

export function filterDistributionZones(zones: DistributionZone[], query: string): DistributionZone[] {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  const search = normalize(query)
  if (!search) return zones
  const exactZones = zones.filter(zone => normalize(zone.code) === search)
  if (exactZones.length) return exactZones
  const isCountryCode = /^[a-z]{2}$/.test(search) && zones.some(zone => zone.countries.some(country => country.code.toLowerCase() === search))
  return zones.flatMap(zone => {
    if (!isCountryCode && normalize(`${zone.code} ${zone.name}`).includes(search)) return [zone]
    const countries = zone.countries.filter(country => isCountryCode ? country.code.toLowerCase() === search : normalize(`${country.name} ${country.code}`).includes(search))
    return countries.length ? [{ ...zone, countries }] : []
  })
}
