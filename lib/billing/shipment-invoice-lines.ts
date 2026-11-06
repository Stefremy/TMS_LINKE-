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
  recipient_country?: string | null
  recipient_zip4?: string | null
  recipient_zip3?: string | null
  recipient_postal?: string | null
  island_transport_mode?: string | null
  vat_pct?: number | null
}
export interface InvoiceLineOptions {
  productId: number; taxId: number; vatRate: number; grouped: boolean
  articleDesignation?: string; articleSummary?: string
  includeWeightInName?: boolean; includeTrackingInName?: boolean; includeServiceNameInName?: boolean
  includeDestinationInSummary?: boolean; includeCityInSummary?: boolean
}
export interface ShipmentInvoiceLine {
  productId: number; name: string; summary: string; qty: number; price: number
  exemptionReason?: string
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

/** PT-CONT tables apply standard IVA (23%); Islands (Açores & Madeira under Art. 14.º CIVA) and International are exempt (0%). */
export function resolveShipmentTaxRate(s: InvoiceShipment, defaultVatRate: number = 23): { vatRate: number; exemptionReason?: string } {
  if (typeof s.vat_pct === 'number' && Number.isFinite(s.vat_pct)) {
    if (s.vat_pct === 0) return { vatRate: 0, exemptionReason: 'M05' }
    return { vatRate: s.vat_pct }
  }
  const service = (s.service_type || '').toLowerCase()
  if (service.includes('ilhas') || service.includes('marítimo') || service.includes('maritimo')) {
    return { vatRate: 0, exemptionReason: 'M05' }
  }
  if (s.island_transport_mode) {
    return { vatRate: 0, exemptionReason: 'M05' }
  }
  const country = (s.recipient_country || 'PT').toUpperCase().trim()
  const postal = (s.recipient_postal || (s.recipient_zip4 ? `${s.recipient_zip4}${s.recipient_zip3 ? `-${s.recipient_zip3}` : ''}` : '')).trim()
  if (country === 'PT') {
    const cleanZip = postal.replace(/\D/g, '')
    // Açores (9500-9999) & Madeira (9000-9499)
    if (/^9\d{3}/.test(cleanZip)) {
      return { vatRate: 0, exemptionReason: 'M05' }
    }
    return { vatRate: defaultVatRate }
  }
  if (country === 'ES') {
    const cleanZip = postal.replace(/\D/g, '').padStart(5, '0')
    if (/^(07|35|38|51|52)/.test(cleanZip)) {
      return { vatRate: 0, exemptionReason: 'M05' }
    }
    return { vatRate: 0, exemptionReason: 'M16' }
  }
  return { vatRate: 0, exemptionReason: 'M05' }
}

export function buildShipmentInvoiceLines(shipments: InvoiceShipment[], o: InvoiceLineOptions): ShipmentInvoiceLine[] {
  const groups = new Map<string, { name: string; summary: string; cents: number; count: number; taxRate: number; exemptionReason?: string }>()
  const lines: ShipmentInvoiceLine[] = []
  const push = (name: string, summary: string, cents: number, taxRate: number, exemptionReason?: string) => {
    if (cents > 0) {
      lines.push({
        productId: o.productId,
        name,
        summary,
        qty: 1,
        price: cents / 100,
        exemptionReason,
        taxes: taxRate > 0 ? [{ tax_id: o.taxId, value: taxRate }] : [],
      })
    }
  }
  const group = (key: string, name: string, summary: string, cents: number, taxRate: number, exemptionReason?: string) => {
    if (cents <= 0) return
    const previous = groups.get(key)
    groups.set(key, {
      name,
      summary,
      cents: (previous?.cents || 0) + cents,
      count: (previous?.count || 0) + 1,
      taxRate,
      exemptionReason,
    })
  }
  let expected = 0
  for (const s of shipments) {
    const b = shipmentChargeBreakdown(s)
    expected += b.total
    const tax = resolveShipmentTaxRate(s, o.vatRate)
    const taxSuffix = tax.vatRate === 0 ? ' (Isento IVA)' : ''
    const service = s.service_type?.trim() || o.articleDesignation || 'Transporte / Logística'
    const ref = s.tracking_number || s.reference || `ENV-${s.id.slice(0, 8).toUpperCase()}`
    const suffix = o.includeTrackingInName === false ? '' : ` - Envio ${ref}`
    const groupKeySuffix = `:${tax.vatRate}:${tax.exemptionReason || 'taxed'}`

    if (o.grouped) {
      const baseServiceName = service.toLowerCase().startsWith('serviço') ? service : `Serviço ${service}`
      const serviceName = `${baseServiceName}${taxSuffix}`
      const fuelName = `${b.fuelName}${taxSuffix}`
      group('base:' + service + groupKeySuffix, serviceName, o.articleSummary || 'Serviços de transporte do período.', b.base, tax.vatRate, tax.exemptionReason)
      group('fuel:' + b.fuelName + groupKeySuffix, fuelName, 'Combustível incluído nos totais dos envios.', b.fuel, tax.vatRate, tax.exemptionReason)
      for (const item of b.items) {
        group('special:' + item.name + groupKeySuffix, `Serviço especial — ${item.name}${taxSuffix}`, 'Suplemento incluído nos totais dos envios.', item.cents, tax.vatRate, tax.exemptionReason)
      }
    } else {
      const name = `${o.includeTrackingInName === false ? 'Envio' : `Envio ${ref}`}${o.includeServiceNameInName === false ? '' : ` - ${service}`}${o.includeWeightInName !== false && s.weight_kg ? ` (Peso: ${s.weight_kg}kg)` : ''}${taxSuffix}`
      const summary = o.includeDestinationInSummary !== false && s.recipient_name ? `Destino: ${s.recipient_name}${o.includeCityInSummary !== false && s.recipient_city ? ` (${s.recipient_city})` : ''}` : ''
      push(name, summary, b.base, tax.vatRate, tax.exemptionReason)
      push(b.fuelName + suffix + taxSuffix, '', b.fuel, tax.vatRate, tax.exemptionReason)
      for (const item of b.items) {
        push(`Serviço especial — ${item.name}${suffix}${taxSuffix}`, '', item.cents, tax.vatRate, tax.exemptionReason)
      }
    }
  }
  for (const [key, g] of groups) {
    push(
      key.startsWith('base:') ? `${g.name} (${g.count} envios)` : g.name,
      g.summary,
      g.cents,
      g.taxRate,
      g.exemptionReason
    )
  }
  if (!Number.isSafeInteger(expected) || lines.reduce((n, l) => n + chargeCents(l.price), 0) !== expected) throw new Error('O total das linhas não corresponde ao total dos envios.')
  return lines
}
