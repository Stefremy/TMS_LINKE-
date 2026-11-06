import names from "./country-names.pt-PT.json"

/** One committed vocabulary for SSR and hydration, independent of the runtime's ICU data. */
export function countryNamePt(code: string): string {
  const normalized = code.toUpperCase() === "UK" ? "GB" : code.toUpperCase()
  return (names as Readonly<Record<string, string>>)[normalized] || normalized
}

/** Portuguese alphabetical order without browser/Node collation differences. */
export function compareCountryNames(a: { code: string; name: string }, b: { code: string; name: string }): number {
  const key = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const left = key(a.name), right = key(b.name)
  return left < right ? -1 : left > right ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0
}
