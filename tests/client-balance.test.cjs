const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const b = createLoader({})('lib/billing/client-balance.ts')

const ship = (sell_price, billing_statement_id = null, status = 'entregue') => ({ sell_price, billing_statement_id, status })

test('pay as you go: wallet = top-ups minus selling totals; receipts do not refund consumption', () => {
  const statements = [{ id: 'paid', moloni_receipt_pdf: 'x' }, { id: 'open', moloni_document_id: 1, total_value: 4 }]
  const shipments = [ship(10, 'paid'), ship(4, 'open'), ship(3), ship(9, null, 'anulado')]
  assert.equal(b.payAsYouGoSpent(shipments, statements), 17)
  assert.equal(b.payAsYouGoBalance(6.15, shipments, statements), -10.85)
})

test('pay as you go: a statement marked paid does not itself refund prepaid shipments', () => {
  assert.equal(b.payAsYouGoSpent([ship(5, 's')], [{ id: 's', status: 'paid' }]), 5)
})

test('pay as you go: overdraft limit of -2.00€ is enforced exactly', () => {
  assert.equal(b.payAsYouGoRefusal(1, 3), null)
  assert.equal(b.payAsYouGoRefusal(1, 3.01) !== null, true)
  assert.match(b.payAsYouGoRefusal(0, 5), /Saldo Insuficiente/)
})

test('conta corrente: owed = pending shipments + unpaid issued statements; paid statements and cancelled shipments excluded', () => {
  const statements = [
    { id: 'a', moloni_document_id: 1, total_value: 20 },
    { id: 'b', moloni_document_id: 2, total_value: 50, moloni_receipt_pdf: 'r' },
    { id: 'c', moloni_document_id: 3, total_value: 8, outstanding_value: 3 },
    { id: 'd', is_pro_forma: true, total_value: 99 },
    { id: 'e', total_value: 6 },
  ]
  const shipments = [ship(4), ship(2, null, 'anulado'), ship(100, 'a')]
  assert.equal(b.currentAccountOutstanding(shipments, statements), 4 + 20 + 3 + 6)
})

test('the two models are independent: a wallet balance never reads statements as debt of an invoiced account and vice versa', () => {
  const shipments = [ship(10), ship(5, 'x')]
  const statements = [{ id: 'x', moloni_document_id: 1, total_value: 5 }]
  assert.equal(b.payAsYouGoSpent(shipments, statements), 15)
  assert.equal(b.currentAccountOutstanding(shipments, statements), 15)
  assert.equal(b.currentAccountOutstanding(shipments, [{ id: 'x', status: 'paid' }]), 10)
  assert.equal(b.payAsYouGoSpent(shipments, [{ id: 'x', status: 'paid' }]), 15)
})

test('loaders fail closed: a read error throws instead of being treated as "nothing paid"', async () => {
  const failing = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'x' } }), then: undefined }) }) }) }) }
  const chain = r => { const c = { select: () => c, eq: () => c, then: (res) => res(r) }; return c }
  await assert.rejects(b.loadClientShipmentsForBalance({ from: () => chain({ data: null, error: { message: 'x' } }) }, 't', 'c'), /validar o saldo/)
  await assert.rejects(b.loadClientStatementsForBalance({ from: () => chain({ data: null, error: { message: 'x' } }) }, 't', 'c'), /validar o saldo/)
  assert.deepEqual(await b.loadClientStatementsForBalance({ from: () => chain({ data: [{ details: { id: 'a' } }], error: null }) }, 't', 'c'), [{ id: 'a' }])
  void failing
})
