// Importa a "Listagem de Envios" da plataforma antiga para public.legacy_shipments (só consulta).
// Uso: node --env-file=.env.local scripts/import-legacy-shipments.cjs <ficheiro.xlsx> <client_id> [--limit N] [--apply]
// Sem --apply só mostra o que faria. Correr outra vez não duplica: atualiza (único por tenant + TRK antigo).
const path = require('node:path')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const text = v => { const s = String(v ?? '').trim(); return s || null }
// The old platform exports Lisbon wall-clock time without an offset.
function lisbon(value) {
  const s = text(value)
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) throw Error(`Data inválida: ${s}`)
  const asUtc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
  const shown = new Date(new Date(asUtc).toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }) + ' UTC').getTime()
  return new Date(asUtc - (shown - asUtc)).toISOString()
}
const num = v => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? null : n }

// Total (s/ IVA) = transporte + taxas + combustível, e combustível = transporte × Fuel Tax %.
function price(r, i) {
  const transport = num(r['Transportation Price']), fees = num(r['Fees Price']), fuel = num(r['Fuel Price'])
  const fuelPct = num(r['Fuel Tax']), total = num(r.Total)
  if (total != null && Math.abs((transport || 0) + (fees || 0) + (fuel || 0) - total) > 0.011) throw Error(`Linha ${i + 2}: Total não bate com as parcelas`)
  return { transport_price: transport, fees_price: fees, fuel_price: fuel, fuel_pct: fuelPct, total_net: total, vat_pct: num(r['VAT Tax']), invoice: text(r.Invoice) }
}

function mapRows(rows, client, sourceFile) {
  return rows.map((r, i) => {
    const trk = text(r.TRK)
    if (!trk) throw Error(`Linha ${i + 2}: sem TRK`)
    if (text(r.Customer)?.toUpperCase() !== client.name.trim().toUpperCase()) throw Error(`Linha ${i + 2}: cliente "${r.Customer}" não é "${client.name}"`)
    return {
      tenant_id: client.tenant_id, client_id: client.id, legacy_trk: trk,
      carrier_tracking_number: text(r['Secondary TRK'])?.replace(/;/g, ' · ') || null,
      reference: text(r.Reference), service: text(r.Service),
      recipient_name: text(r.Recipient), recipient_address: text(r['Recipient Address']),
      recipient_zip: text(r['Recipient ZP']), recipient_city: text(r['Recipient City']),
      recipient_country: text(r['Recipient Country'])?.toUpperCase() || null,
      recipient_phone: text(r['Recipient Contact']), recipient_email: text(r['Recipient E-mail']),
      volumes: num(r.Volumes), weight_kg: num(r['Weight (Kg)']),
      status: text(r['Latest Status']), status_at: lisbon(r['Latest Status Date']),
      receiver_name: text(r['Receiver Name']), shipped_at: lisbon(r['Creation Date']),
      ...price(r, i),
      source_file: sourceFile,
    }
  })
}

async function main() {
  const [file, clientId] = process.argv.slice(2).filter(a => !a.startsWith('--') && !/^\d+$/.test(a))
  const apply = process.argv.includes('--apply')
  const limitAt = process.argv.indexOf('--limit')
  const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) : Infinity
  if (!file || !/^[0-9a-f-]{36}$/i.test(clientId || '')) throw Error('Uso: import-legacy-shipments.cjs <ficheiro.xlsx> <client_id> [--limit N] [--apply]')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: client, error } = await db.from('clients').select('id, name, tenant_id').eq('id', clientId).maybeSingle()
  if (error || !client) throw Error('Cliente não encontrado.')
  const sheet = XLSX.readFile(file).Sheets.Listagem
  if (!sheet) throw Error('Folha "Listagem" não encontrada.')
  const all = mapRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }), client, path.basename(file))
  // The old platform also exports empty shells (no date, status or recipient): nothing to show the client.
  const filled = all.filter(r => r.shipped_at || r.status || r.recipient_name)
  if (filled.length < all.length) console.log(`${all.length - filled.length} linhas vazias ignoradas`)
  const rows = filled.slice(0, limit)
  console.log(`${rows.length} envios para ${client.name}${apply ? '' : ' (simulação, usar --apply para gravar)'}`)
  console.log(rows[0])
  if (!apply) return
  for (let i = 0; i < rows.length; i += 200) {
    const { error: insertError } = await db.from('legacy_shipments')
      .upsert(rows.slice(i, i + 200), { onConflict: 'tenant_id,legacy_trk' })
    if (insertError) throw insertError
  }
  const { count } = await db.from('legacy_shipments').select('id', { count: 'exact', head: true }).eq('client_id', client.id)
  console.log(`Gravado. ${client.name} tem agora ${count} envios do sistema antigo.`)
}

if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1) })
module.exports = { lisbon, mapRows }
