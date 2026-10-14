const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const { buildOperationalReport, getReportRange, reportDay } = createLoader({})('lib/reports/operational-reports.ts')
const { reportCsv } = createLoader({})('lib/reports/report-csv.ts')
const now = new Date('2026-10-14T12:00:00Z')
const clients = [{ id: 'client-a', short_name: 'Loja A' }, { id: 'client-b', short_name: 'Loja B' }]
const row = (id, values = {}) => ({ id, client_id: 'client-a', created_at: '2026-10-12T09:00:00Z',
  status: 'entregue', service_type: 'CTT DD', carrier_code: 'ctt', buy_price: '3.00', sell_price: '5.00', ...values })
const report = (rows, filters = {}) => buildOperationalReport(rows, clients, { period: 'este_mes', ...filters }, now)

test('real stored buy prices produce exact margins, including losses and valid zero costs', () => {
  const result = report([row('a'), row('b', { buy_price: 10, sell_price: 2 }), row('c', { buy_price: 0, sell_price: 0.1 })])
  assert.equal(result.totals.revenue, 7.1)
  assert.equal(result.totals.cost, 13)
  assert.equal(result.totals.margin, -5.9)
  assert.equal(result.totals.negativeMarginCount, 1)
  assert.equal(result.totals.pricedCount, 3)
  assert.equal(result.timeline.find(day => day.date === '2026-10-12').margin, -5.9)
  assert.ok(result.suggestions.some(s => s.id === 'negative-margin'))
})

test('missing and invalid prices never turn into free costs or invented margins', () => {
  const values = [undefined, null, '', ' ', 'invalid', Infinity, -1, true]
  const result = report(values.map((buy_price, i) => row(String(i), { buy_price })))
  assert.equal(result.totals.missingCostCount, values.length)
  assert.equal(result.totals.pricedCount, 0)
  assert.equal(result.totals.margin, 0)
  assert.ok(result.suggestions.some(s => s.id === 'missing-prices'))
  assert.match(reportCsv(result), /"Margem estimada";"Sem dados"/)
})

test('drafts, cancelled records, duplicates, invalid dates and future shipments do not inflate totals', () => {
  const delivered = row('delivered')
  const result = report([delivered, delivered, row('draft', { status: 'rascunho' }),
    row('cancelled', { status: 'anulado' }), row('future', { created_at: '2026-10-15T10:00:00Z' }),
    row('invalid', { created_at: 'not-a-date' }), row('old', { created_at: '2025-01-01T00:00:00Z' })])
  assert.equal(result.totals.volume, 1)
  assert.deepEqual(result.excluded, { drafts: 1, cancelled: 1 })
})

test('statuses partition the selected population and do not imply SLA or first-attempt success', () => {
  const statuses = ['entregue', 'entregue_pudo', 'entrada_rede', 'em_distribuicao', 'pendente', 'incidencia', 'com_incidencia', 'devolvido', 'other']
  const result = report(statuses.map((status, i) => row(String(i), { status })))
  assert.equal(result.totals.delivered, 2)
  assert.equal(result.totals.inTransit, 2)
  assert.equal(result.totals.incidents, 2)
  assert.equal(result.totals.pending, 1)
  assert.equal(result.totals.returned, 1)
  assert.equal(result.totals.other, 1)
  assert.equal(Object.hasOwn(result, 'slaOnTimeRate'), false)
  assert.equal(Object.hasOwn(result, 'avgTransitHours'), false)
})

test('client, carrier and service filters apply to both comparison windows', () => {
  const rows = [row('a'), row('b', { client_id: 'client-b', carrier_code: 'correos', service_type: 'Correos 24' }),
    row('previous', { created_at: '2026-09-12T09:00:00Z' })]
  for (const filters of [{ clientId: 'client-a' }, { carrier: 'CTT Expresso' }, { service: 'CTT DD' }]) {
    const result = report(rows, filters)
    assert.equal(result.totals.volume, 1)
    assert.equal(result.totals.previousVolume, 1)
    assert.equal(result.clients.length, 1)
    assert.equal(result.totals.revenue, 5)
  }
  assert.equal(report(rows, { clientId: 'unknown' }).totals.volume, 0)
})

test('comparison excludes unelapsed days of the previous month and avoids a fabricated growth baseline', () => {
  const result = report([row('current'), row('late-previous', { created_at: '2026-09-25T09:00:00Z' })])
  assert.equal(result.totals.previousVolume, 0)
  assert.equal(result.clients[0].previousVolume, 0)
  assert.equal(result.suggestions.some(s => s.id === 'client-decline'), false)
})

test('client-decline suggestions need an adequate previous sample and respect selected filters', () => {
  const rows = [row('current'), ...Array.from({ length: 5 }, (_, i) => row(`p${i}`, { created_at: '2026-09-12T10:00:00Z' }))]
  assert.ok(report(rows).suggestions.some(s => s.id === 'client-decline'))
  assert.equal(report(rows, { clientId: 'client-b' }).suggestions.length, 0)
  assert.equal(report(rows.slice(0, 4)).suggestions.some(s => s.id === 'client-decline'), false)
})

test('Lisbon day boundaries, calendar week, leap month and daylight saving are respected', () => {
  assert.equal(reportDay(new Date('2026-10-13T23:30:00Z')), '2026-10-14')
  assert.equal(getReportRange('hoje', now).start, '2026-10-13T23:00:00.000Z')
  assert.equal(getReportRange('esta_semana', now).start, '2026-10-11T23:00:00.000Z')
  assert.equal(getReportRange('hoje', new Date('2026-03-29T12:00:00Z')).start, '2026-03-29T00:00:00.000Z')
  assert.equal(getReportRange('hoje', new Date('2026-10-25T12:00:00Z')).start, '2026-10-24T23:00:00.000Z')
  const leap = getReportRange('este_mes', new Date('2024-03-31T12:00:00Z'))
  assert.equal(leap.previousStart, '2024-02-01T00:00:00.000Z')
  assert.equal(leap.previousEnd, leap.start)
})

test('CSV quotes delimiters, preserves negative money and neutralizes spreadsheet formulas', () => {
  const result = buildOperationalReport([row('a', { sell_price: 1, buy_price: 3 })],
    [{ id: 'client-a', short_name: '=HYPERLINK("bad");X' }], { period: 'este_mes' }, now)
  const csv = reportCsv(result)
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"");X"'))
  assert.ok(csv.includes('"-2"'))
  assert.ok(csv.includes('\r\n'))
})

function harness(rows, failure, denied = false) {
  const db = fakeSupabase({ shipments: rows }, failure)
  const load = createLoader({
    '@/lib/auth/context': { requireEmployee: async () => { if (denied) throw new Error('denied'); return { tenant_id: 'tenant-a', role: 'employee' } } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/app/actions/clientes': { getClientesAction: async () => clients },
  })
  return { db, action: load('app/actions/relatorios.ts').getRelatoriosDataAction }
}
test('report action is staff-only, tenant-scoped, paginated, read-only and uses a thin projection', async () => {
  const created_at = new Date(Date.now() - 1000).toISOString()
  const rows = Array.from({ length: 1001 }, (_, i) => row(`a${i}`, { tenant_id: 'tenant-a', created_at }))
  rows.push(row('other-tenant', { tenant_id: 'tenant-b', created_at }))
  const h = harness(rows)
  const result = await h.action('hoje')
  assert.equal(result.totals.volume, 1001)
  assert.equal(h.db.queries.length, 3)
  for (const query of h.db.queries) {
    assert.ok(query.filters.some(f => f.field === 'tenant_id' && f.value === 'tenant-a'))
    assert.ok(query.filters.some(f => f.field === 'created_at' && f.kind === 'gte'))
    assert.ok(query.filters.some(f => f.field === 'created_at' && f.kind === 'lte'))
    assert.doesNotMatch(query.projection, /label|address|phone|email/)
  }
  assert.equal(h.db.writes.length, 0)
  const blocked = harness([], undefined, true)
  await assert.rejects(blocked.action(), /denied/)
  assert.equal(blocked.db.adminClients, 0)
})

test('report action rejects invalid periods and does not show database failures as zero activity', async () => {
  const invalid = harness([])
  await assert.rejects(invalid.action('all-time'), /Período/)
  assert.equal(invalid.db.adminClients, 0)
  const failed = harness([], () => ({ message: 'private database details' }))
  await assert.rejects(failed.action('este_mes'), error => /Não foi possível/.test(error.message) && !/private/.test(error.message))
})
