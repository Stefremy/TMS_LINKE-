/** Split historical, already-charged totals. Never apply today's tariffs here. */
export interface InvoiceShipment {
  id: string
  client_id?: string | null
  tenant_id?: string | null
  sell_price?: number | string | null
  base_price?: number | string | null
  fuel_tax_amount?: number | string | null
  fuel_rate_pct?: number | string | null
  special_fees_amount?: number | string | null
  special_fees_description?: string | null
  service_type?: string | null
  tracking_number?: string | null
  reference?: string | null
  weight_kg?: number | null
  recipient_name?: string | null
  recipient_city?: string | null
}
export interface InvoiceLineOptions {
  productId: number; taxId: number; vatRate: number; grouped: boolean
  articleDesignation?: string; articleSummary?: string
  includeWeightInName?: boolean; includeTrackingInName?: boolean; includeServiceNameInName?: boolean
  includeDestinationInSummary?: boolean; includeCityInSummary?: boolean
}
export interface ShipmentInvoiceLine {
  productId: number; name: string; summary: string; qty: number; price: number
  taxes: { tax_id: number; value: number }[]
}
export function chargeCents(value: unknown): number {
  const n = typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  const cents = Math.round(n * 100)
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(cents)) throw new Error('Discriminação financeira inválida. Confirme os valores guardados no envio.')
  return cents
}
export function shipmentChargeBreakdown(s: InvoiceShipment) {
  const total = chargeCents(s.sell_price ?? 0)
  const fuel = chargeCents(s.fuel_tax_amount ?? 0)
  const special = chargeCents(s.special_fees_amount ?? 0)
  const base = s.base_price == null ? total - fuel - special : chargeCents(s.base_price)
  if (base < 0 || base + fuel + special !== total) throw new Error('A discriminação não corresponde ao total guardado no envio. Confirme os valores antes de faturar.')
  let items: { name: string; cents: number }[] = []
  const desc = s.special_fees_description?.trim() || ''
  if (special > 0 && desc.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(desc)
      if (Array.isArray(parsed)) items = parsed.map((item: unknown) => {
        if (!item || typeof item !== 'object' || !('amount' in item)) throw new Error('Invalid item')
        const name = 'name' in item && typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Serviços especiais'
        return { name, cents: chargeCents(item.amount) }
      }).filter(item => item.cents > 0)
    } catch { items = [] }
    // An old/malformed description must never add charges or change the recorded total.
    if (items.reduce((n, item) => n + item.cents, 0) !== special) items = []
  }
  if (special > 0 && !items.length) items = [{ name: desc && !/^[\[{]/.test(desc) ? desc : 'Serviços especiais', cents: special }]
  const rate = s.fuel_rate_pct == null ? undefined : Number(s.fuel_rate_pct)
  const fuelName = rate !== undefined && Number.isFinite(rate) && rate > 0 ? `Taxa de Combustível (${String(rate).replace('.', ',')}%)` : 'Taxa de Combustível'
  return { total, base, fuel, items, fuelName }
}
export function buildShipmentInvoiceLines(shipments: InvoiceShipment[], o: InvoiceLineOptions): ShipmentInvoiceLine[] {
  const groups = new Map<string, { name: string; summary: string; cents: number; count: number }>()
  const lines: ShipmentInvoiceLine[] = []
  const push = (name: string, summary: string, cents: number) => {
    if (cents > 0) lines.push({ productId: o.productId, name, summary, qty: 1, price: cents / 100, taxes: [{ tax_id: o.taxId, value: o.vatRate }] })
  }
  const group = (key: string, name: string, summary: string, cents: number) => {
    if (cents <= 0) return
    const previous = groups.get(key)
    groups.set(key, { name, summary, cents: (previous?.cents || 0) + cents, count: (previous?.count || 0) + 1 })
  }
  let expected = 0
  for (const s of shipments) {
    const b = shipmentChargeBreakdown(s)
    expected += b.total
    const service = s.service_type?.trim() || o.articleDesignation || 'Transporte / Logística'
    const ref = s.tracking_number || s.reference || `ENV-${s.id.slice(0, 8).toUpperCase()}`
    const suffix = o.includeTrackingInName === false ? '' : ` - Envio ${ref}`
    if (o.grouped) {
      const serviceName = service.toLowerCase().startsWith('serviço') ? service : `Serviço ${service}`
      group('base:' + service, serviceName, o.articleSummary || 'Serviços de transporte do período.', b.base)
      group('fuel:' + b.fuelName, b.fuelName, 'Combustível incluído nos totais dos envios.', b.fuel)
      for (const item of b.items) group('special:' + item.name, `Serviço especial — ${item.name}`, 'Suplemento incluído nos totais dos envios.', item.cents)
    } else {
      const name = `${o.includeTrackingInName === false ? 'Envio' : `Envio ${ref}`}${o.includeServiceNameInName === false ? '' : ` - ${service}`}${o.includeWeightInName !== false && s.weight_kg ? ` (Peso: ${s.weight_kg}kg)` : ''}`
      const summary = o.includeDestinationInSummary !== false && s.recipient_name ? `Destino: ${s.recipient_name}${o.includeCityInSummary !== false && s.recipient_city ? ` (${s.recipient_city})` : ''}` : ''
      push(name, summary, b.base)
      push(b.fuelName + suffix, '', b.fuel)
      for (const item of b.items) push(`Serviço especial — ${item.name}${suffix}`, '', item.cents)
    }
  }
  for (const [key, g] of groups) push(key.startsWith('base:') ? `${g.name} (${g.count} envios)` : g.name, g.summary, g.cents)
  if (!Number.isSafeInteger(expected) || lines.reduce((n, l) => n + chargeCents(l.price), 0) !== expected) throw new Error('O total das linhas não corresponde ao total dos envios.')
  return lines
}
