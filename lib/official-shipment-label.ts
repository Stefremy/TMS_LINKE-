interface ShipmentLabelReference {
  rawId?: string | null
  id?: string | null
  carrier_tracking_number?: string | null
  ctt_object_id?: string | null
  tracking_number?: string | null
  reference?: string | null
}

/** Fetch the saved carrier label through the authorized server action.
 * Never use label blobs cached in a shipment row: these can contain old TMS labels.
 */
export async function fetchOfficialShipmentLabel(
  shipment: ShipmentLabelReference | null | undefined,
  readLabel: (identifier: string) => Promise<string | null>,
  additionalReferences: (string | null | undefined)[] = [],
): Promise<string | null> {
  const references = [
    shipment?.rawId,
    shipment?.id,
    shipment?.carrier_tracking_number,
    shipment?.ctt_object_id,
    shipment?.tracking_number,
    ...additionalReferences,
    shipment?.reference,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()))

  for (const identifier of new Set(references.map(value => value.trim()))) {
    try {
      const label = await readLabel(identifier)
      if (label?.trim()) return label
    } catch {
      // Try the other exact references through the same authorized lookup.
    }
  }
  return null
}
