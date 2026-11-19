'use server'

import { requireUser } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { hydrateShipmentCharges } from '@/lib/services/billing/shipment-charge-snapshots'
import { resolveShipmentTaxRate, shipmentChargeBreakdown, type InvoiceShipment } from '@/lib/billing/shipment-invoice-lines'

export interface ShipmentChargeView {
  vatPct: number
  basePrice: number
  baseVatAmount: number
  fuelRatePct: number | null
  fuelSurchargeAmount: number
  fuelVatAmount: number
  specialItems: { name: string; amount: number; vatAmount: number }[]
  totalPrice: number
  vatAmount: number
  totalWithVat: number
}

/**
 * The charge split recorded when the shipment was priced (same lines as the checkout summary):
 * transport base, fuel, each supplement, subtotal without VAT, VAT per line and total with VAT.
 * Returns null when no consistent historical split exists, never an invented one.
 */
export async function getShipmentChargeBreakdownAction(shipmentId: string): Promise<ShipmentChargeView | null> {
  const ctx = await requireUser()
  if (!ctx.tenant_id || typeof shipmentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shipmentId)) return null
  try {
    const db = createAdminClient()
    let query = db.from('shipments').select('id, tenant_id, client_id, sell_price, service_type, recipient_zip4, recipient_zip3')
      .eq('tenant_id', ctx.tenant_id).eq('id', shipmentId)
    if (ctx.role === 'client') query = query.eq('client_id', ctx.client_id!)
    const { data: row, error } = await query.maybeSingle()
    if (error || !row?.client_id || row.sell_price == null) return null
    const [shipment] = await hydrateShipmentCharges<InvoiceShipment>(db, ctx.tenant_id, row.client_id, [row])
    // No snapshot matching the current price: showing "base = total, fuel 0" would be an invented split.
    if (shipment.base_price == null) return null
    const split = shipmentChargeBreakdown(shipment)
    const { vatRate } = resolveShipmentTaxRate(shipment)
    // Same rounding as the checkout quote: VAT per line, rounded to the cent.
    const vat = (cents: number) => vatRate > 0 ? Math.round(cents * vatRate / 100) : 0
    const items = split.items.map(item => ({ name: item.name, cents: item.cents, vat: vat(item.cents) }))
    const vatCents = vat(split.base) + vat(split.fuel) + items.reduce((sum, item) => sum + item.vat, 0)
    const rate = shipment.fuel_rate_pct == null ? null : Number(shipment.fuel_rate_pct)
    const euros = (cents: number) => cents / 100
    return {
      vatPct: vatRate,
      basePrice: euros(split.base),
      baseVatAmount: euros(vat(split.base)),
      fuelRatePct: rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null,
      fuelSurchargeAmount: euros(split.fuel),
      fuelVatAmount: euros(vat(split.fuel)),
      specialItems: items.map(item => ({ name: item.name, amount: euros(item.cents), vatAmount: euros(item.vat) })),
      totalPrice: euros(split.total),
      vatAmount: euros(vatCents),
      totalWithVat: euros(split.total + vatCents),
    }
  } catch {
    return null
  }
}
