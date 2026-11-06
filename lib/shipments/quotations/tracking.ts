/** Fixed carrier destination; never accept arbitrary tracking URLs from a form. */
export function partnerTrackingUrl(shipment: {
  tracking_carrier?: string; ops_substatus?: string | null;
  tracking_number?: string | null; carrier_tracking_number?: string | null;
} | null | undefined): string | null {
  if (!shipment) return null
  if (shipment.tracking_carrier !== "fedex" && shipment.ops_substatus !== "tracking_fedex_externo") return null
  const code = shipment.carrier_tracking_number || shipment.tracking_number || ""
  return /^\d{10,34}$/.test(code) ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(code)}` : null
}
