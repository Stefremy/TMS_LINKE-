const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const { normalizeBillingStatistics, summarizeBillingStatistics, filterStatisticsInvoices, billingStatisticsCsv, billingDay } = createLoader({})('lib/billing/statistics.ts')
const now = new Date('2026-10-19T12:00:00Z')
const clients = [{ id: 'store-a', short_name: 'Loja A', nif: '123456789' }]
const log = (id, details = {}, extra = {}) => ({ id: `audit-${id}`, action: 'billing_statement', tenant_id: 'tenant-a',
  created_at: '2026-10-18T12:00:00Z', details: { id: `invoice-${id}`, moloni_document_id: id, client_id: 'store-a',
    total_value: 10, ...details }, ...extra })
const normalize = (rows, cycles = []) => normalizeBillingStatistics(rows, clients, cycles, now)

test('transport pre-tax values and custom net values reconcile without counting gross VAT twice', () => {
  const result = normalize([log(1, { status: 'paid', due_date: '2026-10-01' }),
    log(2, { total_net: 8, total_value: 9.84, due_date: '2026-10-19' }, { action: 'custom_invoice' }),
    log(3, { total_net: 2, total_value: 2.46, due_date: '2026-10-01' }, { action: 'custom_invoice' })])
  const summary = summarizeBillingStatistics(result.invoices, result.today, '2026-01-01', result.today)
  assert.deepEqual(summary.totals, { billed: 2000, paid: 1000, open: 1000, overdue: 200, count: 3, missingAmounts: 0 })
  assert.equal(summary.totals.billed, summary.totals.paid + summary.totals.open)
  assert.equal(summary.aging.reduce((sum, bucket) => sum + bucket.amount, 0), summary.totals.open)
  assert.equal(summary.clients.reduce((sum, group) => sum + group.billed, 0), summary.totals.billed)
  assert.equal(summary.months.reduce((sum, month) => sum + month.billed, 0), summary.totals.billed)
  assert.equal(summary.months.length, 10)
})

test('fiscal IDs and record IDs deduplicate, while the latest cancelled version excludes older copies', () => {
  const result = normalize([log(1), log(1, { total_value: 20 }, { id: 'another-log', created_at: '2026-10-19T10:00:00Z' }),
    log(2), log(2, { status: 'cancelled' }, { created_at: '2026-10-19T10:00:00Z' }),
    log(3, { moloni_document_id: 1 }, { action: 'custom_invoice', created_at: '2026-10-17T10:00:00Z' })])
  assert.equal(result.invoices.length, 1)
  assert.equal(result.invoices[0].amountCents, 2000)
  assert.equal(result.coverage.duplicates, 3)
})

test('internal statements, pro-formas, failed attempts and unrelated audit actions never become issued invoices', () => {
  const result = normalize([log(1, { moloni_document_id: null }), log(2, { is_pro_forma: true }),
    log(3, { moloni_document_id: 0 }), log(4, {}, { action: 'period_statement' }), log(5, { status: 'anulado' })])
  assert.equal(result.invoices.length, 0)
  assert.equal(result.coverage.internal, 4)
})

test('unknown monetary values remain unknown, and real zero is preserved', () => {
  const result = normalize([log(1, { total_value: 0 }), log(2, { total_value: '' }),
    log(3, { total_value: 12.3 }, { action: 'custom_invoice' }),
    log(4, { total_value: 12.3, total_tax: 2.3 }, { action: 'custom_invoice' }),
    log(5, { total_value: true })])
  assert.equal(result.coverage.missingAmounts, 3)
  assert.equal(result.invoices.find(i => i.id === '1').amountCents, 0)
  assert.equal(result.invoices.find(i => i.id === '4').amountCents, 1000)
  assert.equal(result.invoices.find(i => i.id === '3').amountCents, null)
})

test('recurring payload supplies recorded dates, while missing maturities are never inferred', () => {
  const result = normalize([log(1), log(2)], [{ invoice_document_id: 1, invoice_payload: { date: '2026-10-10', expiration_date: '2026-10-18' } }])
  const first = result.invoices.find(i => i.id === '1'), second = result.invoices.find(i => i.id === '2')
  assert.equal(first.issuedDate, '2026-10-10')
  assert.equal(first.state, 'overdue')
  assert.equal(second.dueDate, null)
  assert.equal(second.state, 'open')
  const summary = summarizeBillingStatistics(result.invoices, result.today, '', result.today)
  assert.equal(summary.aging.find(bucket => bucket.id === 'unknown').amount, 1000)
})

test('ageing uses calendar days and preserves zero, 30/31 and 60/61 day boundaries', () => {
  const dates = ['2026-10-19', '2026-09-19', '2026-09-18', '2026-08-20', '2026-08-19']
  const data = normalize(dates.map((due_date, index) => log(index + 1, { due_date })))
  const summary = summarizeBillingStatistics(data.invoices, data.today, '', data.today)
  assert.deepEqual(summary.aging.map(bucket => bucket.amount), [1000, 1000, 2000, 1000, 0])
})

test('receipt evidence determines current liquidation, not a fabricated receipt date', () => {
  const result = normalize([log(1, { moloni_receipt_id: 99 }), log(2, { moloni_receipt_pdf: 'https://example.com/receipt.pdf' }), log(3, { status: 'unpaid' })])
  assert.deepEqual(result.invoices.map(i => i.paid).sort(), [false, true, true])
  assert.equal(result.invoices.some(i => Object.hasOwn(i, 'paymentDate')), false)
})

test('an invoice PDF in the receipt field is flagged instead of asserting that cash was received', () => {
  const result = normalize([log(1, { moloni_document_pdf: 'https://example.com/invoice.pdf', moloni_receipt_pdf: 'https://example.com/invoice.pdf' }),
    log(2, { moloni_receipt_pdf: 'https://www.moloni.pt/downloads/index.php?d=2&h=renewed-signature' }),
    log(3, { status: 'paid', moloni_document_pdf: 'https://example.com/same.pdf', moloni_receipt_pdf: 'https://example.com/same.pdf' })])
  assert.equal(result.invoices.find(i => i.id === '1').paid, false)
  assert.equal(result.invoices.find(i => i.id === '1').receiptNeedsReview, true)
  assert.equal(result.invoices.find(i => i.id === '2').receiptNeedsReview, true)
  assert.equal(result.invoices.find(i => i.id === '3').paid, true)
  assert.match(billingStatisticsCsv(result.invoices), /confirmar liquidação/)
})

test('date, client and status filters share the same invoice population, and open includes overdue', () => {
  const data = normalize([log(1, { due_date: '2026-10-01' }), log(2, { status: 'paid' }), log(3, { client_id: 'store-b' })])
  const selection = filterStatisticsInvoices(data.invoices, { start: '2026-10-01', end: data.today, client: 'client:store-a', state: 'open' })
  assert.equal(selection.length, 1)
  assert.equal(selection[0].state, 'overdue')
  assert.equal(filterStatisticsInvoices(data.invoices, { start: '2026-11-01', end: '2026-11-30', client: '', state: 'all' }).length, 0)
})

test('Lisbon dates are stable at midnight and impossible stored days are rejected', () => {
  assert.equal(billingDay('2026-07-01T23:30:00Z'), '2026-07-02')
  assert.equal(billingDay('2026-02-30'), null)
  assert.equal(billingDay('nonsense'), null)
})

test('consumer VAT and identical names cannot merge unrelated customers', () => {
  const rows = normalize([log(1, { client_id: null, client_name: 'Consumidor', client_vat: '999999990' }),
    log(2, { client_id: null, client_name: 'Consumidor', client_vat: '999999990' })]).invoices
  assert.notEqual(rows[0].clientKey, rows[1].clientKey)
})

test('CSV contains only filtered rows, escapes user text and protects against spreadsheet formulas', () => {
  const data = normalize([log(1, { client_id: null, client_name: '=SUM(1,2)', invoice_number: '"quoted"' }, { action: 'custom_invoice' })])
  const csv = billingStatisticsCsv(data.invoices)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes("'=SUM(1,2)"))
  assert.ok(csv.includes('""quoted""'))
  assert.ok(csv.includes('Sem valor líquido registado'))
})

function sourceLoader(db, context = { tenant_id: 'tenant-a' }) {
  return createLoader({ 'server-only': {}, '@/lib/auth/context': { requireEmployee: async () => { if (!context) throw new Error('Acesso negado'); return context } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() }, '@/app/actions/clientes': { getClientesAction: async () => clients } })('lib/billing/statistics-data.ts')
}

test('source reads every page, enforces the employee tenant on every query and never writes', async () => {
  const db = fakeSupabase({ audit_log: [...Array.from({ length: 1001 }, (_, index) => log(index + 1)), log(9999, {}, { tenant_id: 'tenant-b' })],
    recurring_statement_cycles: [{ id: 'cycle', tenant_id: 'tenant-b', invoice_document_id: 9999, invoice_payload: {} }] })
  const result = await sourceLoader(db).loadBillingStatistics()
  assert.equal(result.invoices.length, 1001)
  assert.ok(db.queries.every(query => query.filters.some(filter => filter.field === 'tenant_id' && filter.value === 'tenant-a')))
  assert.ok(db.queries.some(query => query.table === 'audit_log' && query.range[0] === 1000))
  assert.equal(db.writes.length, 0)
})

test('unauthorized users cannot initialize a privileged client', async () => {
  const db = fakeSupabase({})
  await assert.rejects(sourceLoader(db, null).loadBillingStatistics(), /Acesso negado/)
  assert.equal(db.adminClients, 0)
})

test('a failed invoice read is an error rather than zero revenue; optional cycle failures are disclosed', async () => {
  const failed = fakeSupabase({}, query => query.table === 'audit_log' ? { message: 'offline' } : null)
  await assert.rejects(sourceLoader(failed).loadBillingStatistics(), /carregar os documentos/)
  const optional = fakeSupabase({ audit_log: [log(1)] }, query => query.table === 'recurring_statement_cycles' ? { message: 'missing migration' } : null)
  const result = await sourceLoader(optional).loadBillingStatistics()
  assert.equal(result.cyclesUnavailable, true)
  assert.equal(result.invoices.length, 1)
})
