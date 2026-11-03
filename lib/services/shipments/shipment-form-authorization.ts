/** Check the authenticated server role before parsing or discarding any submitted fields. */
export function shipmentOverrideError(role: string | null, input: unknown): { field: string; message: string } | null {
  if (!input || typeof input !== "object") return null
  const data = input as Record<string, unknown>
  const protectedFields = ["manualPrice", "manual_price", "carrierOverride", "carrier_override", "internalNotes", "internal_notes", "specialFeeOverrides", "special_fee_overrides", "emitMoloniGt"]
  const submitted = protectedFields.find(field => Object.hasOwn(data, field) && data[field] !== undefined)
  if (role === "client" && submitted) return { field: submitted, message: "Este campo está reservado à equipa de operações." }
  if (Object.hasOwn(data, "manualPrice") || Object.hasOwn(data, "manual_price")) return { field: "manualPrice", message: "O preço é definido pela tabela do cliente." }
  return null
}
