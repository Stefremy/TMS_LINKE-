const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const logic = createLoader({})('lib/billing/recurring-periods.ts')
const TENANT = '11111111-1111-1111-1111-111111111111'
const CLIENT = '22222222-2222-2222-2222-222222222222'
const client = { id: CLIENT, tenant_id: TENANT, short_name: 'Loja teste', billing_type: 'conta_corrente', payment_terms: 'A 7 dias', billing_email: 'billing@example.invalid', created_at: '2026-09-01T00:00:00Z' }
const shipment = (id, created_at, extra = {}) => ({ id, tenant_id: TENANT, client_id: CLIENT, created_at, status: 'pendente', sell_price: 3.91, ...extra })
const statement = { id: 'period-id', client_id: CLIENT, document_type: 'period_statement', client_name: 'Loja teste', client_snapshot: { name: 'Loja teste' }, statement_number: 'EXT-AUTO/TEST', period_start: '2026-10-16', period_end: '2026-10-23', cycle_days: 7, shipments_count: 1, shipments: [shipment('one', '2026-10-16T08:00:00Z')], shipment_ids: ['one'], total_value: 3.91, created_at: '2026-10-23T08:00:00Z' }

test('all payment intervals close on calendar-day boundaries, including Pronto Pagamento', () => {
  for (const days of [7,15,30,45,60,90]) {
    assert.equal(logic.cycleDaysForTerms(`A ${days} dias`), days)
    const period = logic.periodForClient({ ...client, payment_terms: `A ${days} dias` }, '2026-10-16')
    assert.equal(period.start, '2026-10-16')
    assert.equal(period.end, logic.addCalendarDays('2026-10-16', days))
  }
  assert.equal(logic.cycleDaysForTerms('Pronto Pagamento'), 1)
  for (const term of ['', undefined, 'A 0 dias', 'A 365 dias', 'mensal', 'sem prazo']) assert.equal(logic.cycleDaysForTerms(term), null)
})
test('activation excludes old shipments; new clients start on their own creation date', () => {
  assert.equal(logic.periodForClient(client, '2026-10-16').start, '2026-10-16')
  assert.equal(logic.periodForClient({ ...client, created_at: '2026-11-02T10:00:00Z' }, '2026-10-16').start, '2026-11-02')
  assert.equal(logic.periodForClient(client, '2026-10-16', '2026-10-23').start, '2026-10-23')
})
test('Lisbon calendar dates survive summer/winter clock changes and month/year boundaries', () => {
  assert.equal(logic.lisbonDate('2026-10-24T23:30:00Z'), '2026-10-25')
  assert.equal(logic.lisbonDate('2026-10-25T23:30:00Z'), '2026-10-25')
  assert.equal(logic.addCalendarDays('2026-10-24', 2), '2026-10-26')
  assert.equal(logic.addCalendarDays('2026-12-31', 1), '2027-01-01')
  assert.equal(logic.addCalendarDays('2028-02-28', 1), '2028-02-29')
  assert.equal(logic.isDateKey('2026-02-30'), false)
  assert.equal(logic.isDateKey('2026-2-03'), false)
})
test('only active current-account customers enter the automation; billing email takes precedence', () => {
  assert.equal(logic.eligibleRecurringClient(client), true)
  for (const extra of [{ billing_type: 'pay_as_you_go' }, { billing_type: undefined }, { is_active: false }]) assert.equal(logic.eligibleRecurringClient({ ...client, ...extra }), false)
  assert.equal(logic.billingRecipient({ ...client, email: 'other@example.invalid' }), 'billing@example.invalid')
  assert.equal(logic.billingRecipient({ ...client, billing_email: '  ', email: 'other@example.invalid' }), 'other@example.invalid')
  assert.equal(logic.billingRecipient({ ...client, billing_email: 'bad@example.invalid\nCc:attacker@example.invalid' }), null)
})
test('period selection is tenant/client scoped, includes the start and excludes the exact next boundary', () => {
  const shipments = [
    shipment('before', '2026-10-15T22:59:59Z'), shipment('start', '2026-10-15T23:00:00Z'),
    shipment('last', '2026-10-22T22:59:59Z'), shipment('next', '2026-10-22T23:00:00Z'),
    shipment('foreign-company', '2026-10-16T08:00:00Z', { tenant_id: 'foreign' }),
    shipment('foreign-client', '2026-10-16T08:00:00Z', { client_id: 'foreign' }),
    shipment('missing-tenant', '2026-10-16T08:00:00Z', { tenant_id: undefined }),
    shipment('cancelled', '2026-10-16T08:00:00Z', { status: 'cancelado' }),
    shipment('draft', '2026-10-16T08:00:00Z', { status: 'rascunho' }),
    shipment('billed', '2026-10-16T08:00:00Z'), shipment('linked', '2026-10-16T08:00:00Z', { billing_statement_id: 'existing' }),
  ]
  const selected = logic.selectPeriodShipments(CLIENT, TENANT, '2026-10-16', '2026-10-23', shipments, new Set(['billed']))
  assert.deepEqual(selected.map(s => s.id), ['start', 'last'])
  assert.equal(logic.shipmentTotal(selected), 7.82)
  assert.throws(() => logic.shipmentTotal([{ sell_price: null }]), /preço válido/)
  assert.throws(() => logic.shipmentTotal([{ sell_price: -1 }]), /preço válido/)
})
test('delivery hours use Lisbon time in summer and winter', () => {
  assert.equal(logic.isBillingDeliveryHour(new Date('2026-07-16T08:00:00Z')), true)
  assert.equal(logic.isBillingDeliveryHour(new Date('2026-12-16T08:00:00Z')), false)
  assert.equal(logic.isBillingDeliveryHour(new Date('2026-12-16T09:00:00Z')), true)
  assert.equal(logic.isBillingDeliveryHour(new Date('2026-07-16T18:00:00Z')), false)
})

function harness({ invoiceReady = true, invoicePdfFailure = false, failure = false, alreadySent = false, persistedPayload = null, leased = false, clients = [client] } = {}) {
  const cycle = { id: 'cycle-id', client_id: CLIENT, statement_id: 'period-id', period_end: '2026-10-23', delivery_status: alreadySent ? 'sent' : 'pending', email_payload: persistedPayload, lease_token: 'lease-token' }
  const db = fakeSupabase({ audit_log: [
    ...clients.map(c => ({ id: `profile-${c.id}`, tenant_id: TENANT, action: 'client_data', details: c, created_at: '2026-10-01' })),
    { id: 'period-id', tenant_id: TENANT, action: 'period_statement', details: statement, created_at: '2026-10-23' },
  ], clients: clients.map(c => ({ id: c.id, tenant_id: TENANT, created_at: '2026-09-01' })), recurring_statement_settings: [{ tenant_id: TENANT, enabled: true, anchor_date: '2026-10-16' }], recurring_statement_cycles: [] })
  const emails = [], rpcs = []
  let pdfCalls = 0
  const api = { ...db.client, rpc: async (name, args) => {
    rpcs.push({ name, args })
    assert.equal(args.p_tenant, TENANT)
    if (name === 'claim_recurring_statement_email') {
      if (cycle.delivery_status === 'sent' || leased || cycle.delivery_status === 'processing') return { data: null, error: null }
      cycle.delivery_status = 'processing'
      return { data: structuredClone(cycle), error: null }
    }
    if (name === 'prepare_recurring_statement_email') { cycle.email_payload ||= args.p_payload; return { data: true, error: null } }
    if (name === 'finish_recurring_statement_email') { cycle.delivery_status = args.p_status; return { data: true, error: null } }
    throw new Error(`Unexpected RPC ${name}`)
  } }
  const load = createLoader({
    '@/lib/billing/recurring-invoices': { ensureRecurringInvoice: async () => invoiceReady, recurringInvoiceAttachment: async () => { if (invoicePdfFailure) throw Error('PDF unavailable'); return { number: 'FT 2026/123', filename: 'Fatura.pdf', content: 'JVBERi0=' } } },
    '@/lib/supabase/server': { createAdminClient: () => api },
    '@/lib/email/resend': { sendEmail: async payload => { emails.push(payload); return failure ? { success: false, error: 'offline' } : { success: true, data: { id: 'provider-123' } } } },
    '@/lib/services/billing/statement-pdf': { generateStatementPdfBuffer: async () => { pdfCalls++; return Buffer.from('mock-pdf') } },
  })
  return { ...load('lib/billing/recurring-statements.ts'), db, api, cycle, emails, rpcs, get pdfCalls() { return pdfCalls } }
}
test('a successful delivery persists the payload before sending, records acknowledgement and cannot resend', async () => {
  const h = harness()
  assert.equal((await h.deliverPeriodStatement(TENANT, 'cycle-id', client)).status, 'sent')
  assert.equal(h.emails.length, 1)
  assert.equal(h.emails[0].attachments.length, 2)
  assert.equal(h.emails[0].attachments[0].filename, 'Fatura.pdf')
  assert.match(h.emails[0].subject, /FT 2026\/123/)
  assert.equal(h.emails[0].idempotencyKey, `period-statement/${TENANT}/cycle-id`)
  assert.equal(h.rpcs[1].name, 'prepare_recurring_statement_email')
  assert.equal(h.rpcs.at(-1).args.p_status, 'sent')
  assert.equal((await h.deliverPeriodStatement(TENANT, 'cycle-id', client)).status, 'skipped')
  assert.equal(h.emails.length, 1)
  assert.equal(h.db.writes.length, 0, 'No shipment, invoice or balance writes')
})
test('provider refusal is recorded as failure, never as emailed', async () => {
  const h = harness({ failure: true })
  assert.equal((await h.deliverPeriodStatement(TENANT, 'cycle-id', client)).status, 'failed')
  assert.equal(h.rpcs.at(-1).args.p_status, 'failed')
  assert.equal(h.rpcs.at(-1).args.p_message_id, null)
})
test('retries reuse identical stored PDF, recipient and payload even if the client email changes', async () => {
  const saved = { to: 'old@example.invalid', from: 'sender@example.invalid', subject: 'Original', html: '<p>Original</p>', attachments: [{ filename: 'old.pdf', content: 'b2xk' }] }
  const h = harness({ persistedPayload: saved })
  await h.deliverPeriodStatement(TENANT, 'cycle-id', { ...client, billing_email: 'changed@example.invalid' })
  assert.equal(h.pdfCalls, 0)
  assert.deepEqual(h.emails[0], { ...saved, idempotencyKey: `period-statement/${TENANT}/cycle-id` })
})
test('concurrent workers cannot both deliver the same cycle', async () => {
  const h = harness()
  const deliveries = await Promise.all([h.deliverPeriodStatement(TENANT, 'cycle-id', client), h.deliverPeriodStatement(TENANT, 'cycle-id', client)])
  assert.equal(h.emails.length, 1)
  assert.deepEqual(deliveries.map(d => d.status).sort(), ['sent', 'skipped'])
})
test('missing recipient blocks the cycle without touching a provider or preparing an attachment', async () => {
  const h = harness()
  const result = await h.deliverPeriodStatement(TENANT, 'cycle-id', { ...client, billing_email: '' })
  assert.equal(result.status, 'blocked')
  assert.equal(h.emails.length, 0)
  assert.equal(h.pdfCalls, 0)
})
test('Pay as You Go and inactive clients cannot receive queued period emails', async () => {
  const h = harness()
  for (const extra of [{ billing_type: 'pay_as_you_go' }, { is_active: false }]) await h.deliverPeriodStatement(TENANT, 'cycle-id', { ...client, ...extra })
  assert.equal(h.rpcs.length, 0)
  assert.equal(h.emails.length, 0)
})
test('client selection uses the latest profile and removes deleted/unregistered clients', async () => {
  const h = harness()
  const db = fakeSupabase({ clients: [{ id: CLIENT, tenant_id: TENANT }], audit_log: [
    { id: 'old', tenant_id: TENANT, action: 'client_data', details: client, created_at: '2026-10-01' },
    { id: 'new', tenant_id: TENANT, action: 'client_data', details: { ...client, billing_type: 'pay_as_you_go' }, created_at: '2026-10-02' },
    { id: 'foreign', tenant_id: 'other', action: 'client_data', details: client, created_at: '2026-10-03' },
  ] })
  assert.deepEqual(await h.loadRecurringClients(db.client, TENANT), [])
  assert.ok(db.queries.every(q => q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT)))
})
test('cron fails closed without the secret and rejects force before touching the billing service', async () => {
  const original = process.env.CRON_SECRET
  let runs = 0
  const load = createLoader({ 'next/server': { NextResponse: { json: (data, init = {}) => new Response(JSON.stringify(data), init) } },
    '@/lib/billing/recurring-statements': { runRecurringStatements: async () => { runs++; return { generated: 0, sent: 0, errors: [] } } } })
  const { GET } = load('app/api/cron/billing/route.ts')
  try {
    delete process.env.CRON_SECRET
    assert.equal((await GET(new Request('https://test.invalid/api/cron/billing'))).status, 503)
    process.env.CRON_SECRET = 'fixture-secret'
    assert.equal((await GET(new Request('https://test.invalid/api/cron/billing'))).status, 401)
    assert.equal((await GET(new Request('https://test.invalid/api/cron/billing?force=true', { headers: { authorization: 'Bearer fixture-secret' } }))).status, 400)
    assert.equal(runs, 0)
    assert.equal((await GET(new Request('https://test.invalid/api/cron/billing', { headers: { authorization: 'Bearer fixture-secret' } }))).status, 200)
    assert.equal(runs, 1)
  } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original }
})
test('period statements appear in the client archive without becoming unpaid invoices', () => {
  const { groupInvoiceArchive } = createLoader({})('lib/billing/invoice-archive.ts')
  const [group] = groupInvoiceArchive([client], [statement])
  assert.equal(group.periodCount, 1)
  assert.equal(group.awaitingReceiptCount, 0)
  assert.equal(group.paidCount, 0)
})


test('returning from prepaid starts a fresh period even when an older cycle exists', () => {
  const returning = { ...client, recurring_since: '2026-11-03' }
  assert.equal(logic.periodForClient(returning, '2026-10-16', '2026-10-23').start, '2026-11-03')
  assert.equal(logic.periodForClient(returning, '2026-10-16', '2026-11-10').start, '2026-11-10')
})
test('ordinary profile edits keep the window; a prepaid transition resets eligibility', async () => {
  const h = harness()
  const db = fakeSupabase({ clients: [{ id: CLIENT, tenant_id: TENANT }], audit_log: [
    { id: 'prepaid', tenant_id: TENANT, action: 'client_data', details: { ...client, billing_type: 'pay_as_you_go' }, created_at: '2026-10-05T10:00:00Z' },
    { id: 'returned', tenant_id: TENANT, action: 'client_data', details: client, created_at: '2026-10-10T10:00:00Z' },
    { id: 'edited', tenant_id: TENANT, action: 'client_data', details: { ...client, payment_terms: 'A 15 dias' }, created_at: '2026-10-12T10:00:00Z' },
  ] })
  const loaded = await h.loadRecurringClients(db.client, TENANT)
  assert.equal(loaded[0].recurring_since, '2026-10-10')
  assert.equal(loaded[0].payment_terms, 'A 15 dias')
})

test('closed empty periods advance the cursor without sending or creating accounting entries', async () => {
  const rows = { clients: [{ id: CLIENT, tenant_id: TENANT }],
    audit_log: [{ id: 'profile', tenant_id: TENANT, action: 'client_data', details: client, created_at: '2026-09-01' }],
    recurring_statement_settings: [{ tenant_id: TENANT, enabled: true, anchor_date: '2026-09-25' }], recurring_statement_cycles: [] }
  const db = fakeSupabase(rows), periods = []
  const api = { ...db.client, rpc: async (name, args) => {
    assert.equal(name, 'reserve_recurring_statement')
    periods.push([args.p_start, args.p_end]); return { data: { empty: true }, error: null }
  } }
  const load = createLoader({ '@/lib/billing/recurring-invoices': {}, '@/lib/supabase/server': { createAdminClient: () => api },
    '@/lib/email/resend': { sendEmail: () => { throw Error('Empty periods must not email') } },
    '@/lib/services/billing/statement-pdf': {} })
  const { runRecurringStatements } = load('lib/billing/recurring-statements.ts')
  const result = await runRecurringStatements(new Date('2026-10-16T10:00:00Z'))
  assert.deepEqual(periods, [['2026-09-25','2026-10-02'],['2026-10-02','2026-10-09'],['2026-10-09','2026-10-16']])
  assert.equal(result.sent, 0); assert.equal(result.generated, 0); assert.equal(db.writes.length, 0)
  periods.length = 0
  assert.equal((await runRecurringStatements(new Date('2026-10-16T23:00:00Z'))).skipped, 'outside_delivery_hours')
  assert.equal(periods.length, 0)
})
test('recurring server actions reject unauthorized access before reading or writing data', async () => {
  let touched = false
  const denied = async () => { throw Error('Forbidden') }
  const load = createLoader({ '@/lib/auth/context': { requireAdmin: denied, requirePermission: denied },
    '@/lib/supabase/server': { createAdminClient: () => { touched = true; throw Error('Unexpected database access') } },
    'next/cache': { revalidatePath: () => { touched = true } },
    '@/lib/billing/recurring-statements': { recurringPreview: () => { touched = true }, loadPeriodStatements: () => { touched = true }, sendRecurringStatementTest: () => { touched = true } } })
  const actions = load('app/actions/recurring-statements.ts')
  for (const [name, args] of [['previewRecurringStatementsAction', []], ['getPeriodStatementsAction', []], ['getPeriodShipmentsForBillingAction', ['foreign-id']], ['configureRecurringStatementsAction', [true,'2026-10-16']], ['sendRecurringTestEmailAction', ['test@example.invalid']]]) {
    await assert.rejects(actions[name](...args), /Forbidden/)
  }
  assert.equal(touched, false)
})

test('no email is sent before fiscal confirmation or when the official invoice PDF is unavailable', async () => {
  const pending = harness({ invoiceReady: false })
  assert.equal((await pending.deliverPeriodStatement(TENANT, 'cycle-id', client)).status, 'failed')
  assert.equal(pending.emails.length, 0); assert.equal(pending.rpcs.length, 0)
  const missingPdf = harness({ invoicePdfFailure: true })
  assert.equal((await missingPdf.deliverPeriodStatement(TENANT, 'cycle-id', client)).status, 'failed')
  assert.equal(missingPdf.emails.length, 0)
  assert.match(missingPdf.rpcs.at(-1).args.p_error, /dois PDFs/)
})
