import { COUNTRY_TO_ZONE_MAP, CTT_CE_TRUCK_ZONES, OFFICIAL_LINKE_ZONES } from "./international-zones"
import { CTT_AIR_COUNTRY_NAMES, CTT_AIR_ZONES } from "./ctt-air-zones"

export interface DistributionCountry { code: string; name: string }
export interface DistributionZone { code: string; name: string; countries: DistributionCountry[] }
export interface DistributionZoneGroup {
  id: "ctt_road" | "ctt_air" | "correos_international"
  carrier: string
  service: string
  description: string
  zones: DistributionZone[]
}

const countryNames = new Intl.DisplayNames(["pt-PT"], { type: "region" })
function countriesFromCodes(codes: readonly string[], names: Readonly<Record<string, string>> = {}): DistributionCountry[] {
  return [...new Set(codes.filter(code => /^[A-Z]{2}$/.test(code)).map(code => code === "UK" ? "GB" : code))]
    .map(code => ({ code, name: names[code] || countryNames.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"))
}

/** Display each carrier's coverage using its own service's zone definitions. */
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
      id: "ctt_air", carrier: "CTT Expresso", service: "Internacional Aéreo · Guia EE",
      description: "Seis zonas da tabela contratual CTT Internacional (Outbound), com origem em Portugal Continental.",
      zones: CTT_AIR_ZONES.map(zone => ({
        code: zone.code, name: "Internacional Aéreo Expresso", countries: countriesFromCodes(zone.countries, CTT_AIR_COUNTRY_NAMES),
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
