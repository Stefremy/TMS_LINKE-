/** Keep the manual billing list aligned with claim_billing_shipments in Supabase. */
export function canInvoiceShipment(shipment: { status?: string | null }): boolean {
  return !['rascunho', 'draft', 'anulado', 'cancelado', 'cancelled', 'canceled']
    .includes((shipment.status || '').trim().toLowerCase())
}
