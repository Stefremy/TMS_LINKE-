import type { ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function canonicalCode(value: unknown): string {
  const code = textValue(value).toUpperCase()
  return code.replace(/^EU-(?:ZONA|Z)([123])$/, "EU $1")
}

export function getSimulationZoneName(zone: ZonePriceMatrix): string {
  const legacyName = "name" in zone ? zone.name : undefined
  return textValue(zone.zone_name) || textValue(legacyName) || textValue(zone.zone_code)
}

/** Codes take priority; legacy names may contain a complete destination code. */
export function findSimulationZone(
  zones: readonly ZonePriceMatrix[] | null | undefined,
  destinationCode: string,
): ZonePriceMatrix | undefined {
  if (!Array.isArray(zones)) return undefined
  const code = canonicalCode(destinationCode)
  if (!code) return undefined
  const validZones = zones.filter((zone): zone is ZonePriceMatrix => !!zone && typeof zone === "object")
  const exactZone = validZones.find(zone => canonicalCode(zone.zone_code) === code)
  if (exactZone) return exactZone

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const codeInName = new RegExp(`(?:^|[^A-Z0-9])${escapedCode}(?:$|[^A-Z0-9])`)
  return validZones.find(zone => codeInName.test(getSimulationZoneName(zone).toUpperCase()))
}
