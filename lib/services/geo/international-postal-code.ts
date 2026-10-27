import type { PostalCodeLookupResult } from "./postal-code.service"

// Coverage and partial-code formats: https://api.zippopotam.us/
const supportedCountries = new Set("AD AR AS AT AU BD BE BG BR CA CH CZ DE DK DO ES FI FO FR GB GF GG GL GP GT GU GY HR HU IM IN IS IT JE JP LI LK LT LU MC MD MH MK MP MQ MX MY NL NO NZ PH PK PL PM PR PT RE RU SE SI SJ SK SM TH TR US VA VI YT".split(" "))

export function internationalPostalQuery(raw: string, country: string): string | null {
  country = country.trim().toUpperCase()
  const code = raw.trim().toUpperCase().replace(/\s+/g, " ")
  if (!supportedCountries.has(country) || !/^[A-Z0-9 -]{3,12}$/.test(code)) return null
  if (country === "GB") {
    // Provider has outward codes only. Keep the full postcode in the form.
    const compact = code.replace(/ /g, "")
    const outward = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact) ? compact.slice(0, -3) : compact
    return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) ? outward : null
  }
  if (country === "CA") return /^[A-Z]\d[A-Z](?: ?\d[A-Z]\d)?$/.test(code) ? code.slice(0, 3) : null
  if (country === "NL") return /^\d{4}(?: ?[A-Z]{2})?$/.test(code) ? code.slice(0, 4) : null
  if (country === "US") return /^\d{5}(?:-\d{4})?$/.test(code) ? code.slice(0, 5) : null
  if (country === "CZ" || country === "SK") return /^\d{3} ?\d{2}$/.test(code) ? code.replace(/ /g, "").replace(/^(\d{3})/, "$1 ") : null
  if (country === "SE") return /^\d{3} ?\d{2}$/.test(code) ? code.replace(/ /g, "") : null
  if (country === "LU") return /^(?:L-)?\d{4}$/.test(code) ? `L-${code.replace(/^L-/, "")}` : null
  if (["BE", "AT", "CH", "DK", "NO", "HU", "SI", "BG"].includes(country)) return /^\d{4}$/.test(code) ? code : null
  if (["FR", "DE", "ES", "FI", "IT"].includes(country)) return /^\d{5}$/.test(code) ? code : null
  return code
}

export async function lookupInternationalPostalCode(raw: string, country: string): Promise<PostalCodeLookupResult | null> {
  country = country.trim().toUpperCase()
  const query = internationalPostalQuery(raw, country)
  if (!query) return null
  try {
    const response = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 86400 },
    })
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (!data || typeof data !== "object" || !("places" in data) || !Array.isArray(data.places)) return null
    if (!("country abbreviation" in data) || data["country abbreviation"] !== country) return null
    const cities = [...new Set<string>(data.places.flatMap((place: unknown) => {
      if (!place || typeof place !== "object" || !("place name" in place) || typeof place["place name"] !== "string") return []
      return place["place name"].trim() ? [place["place name"].trim()] : []
    }))]
    if (!cities.length) return null
    return { found: true, country, postalCode: raw.trim(), city: cities.length === 1 ? cities[0] : "", cities }
  } catch {
    // Optional assistance: provider failure must never block manual entry.
    return null
  }
}
