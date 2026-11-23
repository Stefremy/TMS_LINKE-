// Day-in-the-life of a pay as you go store, using the same rules the portal, Ops and SQL use.
const test = require('node:test'), assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const load = createLoader({})
const bal = load('lib/billing/client-balance.ts')
const lim = load('lib/billing/client-limit.ts')

const SINCE = '2026-11-09T00:00:00Z'
const ship = (price, status = 'pendente', created_at = '2026-11-10T10:00:00Z') => ({ sell_price: price, status, created_at })

test('a new prepaid store starts at 0€ and cannot ship before topping up', () => {
  const store = lim.switchBillingModel({ billing_type: 'conta_corrente', credit_limit: 5000 }, 'pay_as_you_go', { billing_type: 'conta_corrente', credit_limit: 5000 })
  assert.equal(store.credit_limit, 0, 'the 5000€ invoicing limit never becomes wallet money')
  assert.equal(store.category, 'Cliente Pré-Pagamento')
  assert.match(bal.payAsYouGoRefusal(0, 4.12), /Saldo insuficiente/)
  assert.equal(bal.payAsYouGoRefusal(0, 0.01), 'Saldo insuficiente para criar este envio. O envio custa 0,01 € e o seu saldo é de 0,00 €. Faltam 0,01 €. Carregue saldo para continuar.', 'no overdraft at all')
})

test('top up 10€, ship until exactly 0€, cancel one and the money comes back', () => {
  const credit = lim.applyWalletInjection(0, lim.parseWalletInjection('10,00'))
  assert.equal(credit, 10)
  const shipments = []
  const balance = () => bal.payAsYouGoBalance(credit, shipments, [], SINCE)
  for (const expected of [5.88, 1.76]) {
    assert.equal(bal.payAsYouGoRefusal(balance(), 4.12), null); shipments.push(ship(4.12)); assert.equal(balance(), expected)
  }
  assert.equal(bal.payAsYouGoRefusal(balance(), 4.12), 'Saldo insuficiente para criar este envio. O envio custa 4,12 € e o seu saldo é de 1,76 €. Faltam 2,36 €. Carregue saldo para continuar.')
  assert.equal(bal.payAsYouGoRefusal(balance(), 1.76), null, 'landing exactly on 0,00€ is allowed')
  assert.notEqual(bal.payAsYouGoRefusal(balance(), 1.77), null)
  shipments.push(ship(1.76)); assert.equal(balance(), 0)
  shipments[0].status = 'anulado'
  assert.equal(balance(), 4.12, 'cancelling returns the 4.12€')
})

test('fuel/extras are already in the selling price and receipts never refill the wallet', () => {
  const shipments = [{ ...ship(5.43), fuel_tax_amount: 0.31 }]
  assert.equal(bal.payAsYouGoBalance(20, shipments, [{ status: 'paid', total_value: 5.43, moloni_receipt_id: 9 }], SINCE), 14.57)
})

test('shipments from before the switch stay on the invoiced account and do not touch the wallet', () => {
  const store = { billing_type: 'pay_as_you_go', pay_as_you_go_since: SINCE }
  const old = ship(7.25, 'entregue', '2026-11-01T10:00:00Z'), fresh = ship(4.12, 'entregue')
  assert.equal(bal.isPrepaidShipment(store, old), false); assert.equal(bal.isPrepaidShipment(store, fresh), true)
  assert.equal(bal.payAsYouGoBalance(50, [old, fresh], [], SINCE), 45.88)
  assert.equal(bal.isPrepaidShipment({ billing_type: 'conta_corrente' }, fresh), false)
})

test('Ops wallet adjustments: corrections, refusals and the preview the operator sees', () => {
  assert.equal(lim.parseWalletInjection('-10.5'), -10.5)
  for (const bad of ['0', 'abc', '1e3', '10,123', '100001', '']) assert.equal(lim.parseWalletInjection(bad), null, bad)
  const preview = lim.walletPreview({ billing_type: 'pay_as_you_go', credit_limit: 100, available_credit: 60 }, 150)
  assert.deepEqual(preview, { wasPrepaid: true, baseLoaded: 100, currentBalance: 60, pending: 50, projected: 110 })
  assert.equal(lim.walletPreview({ billing_type: 'conta_corrente', credit_limit: 5000 }, 0).projected, 0)
})

test('switching back to conta corrente restores the invoicing limit; clients never see that limit', () => {
  const initial = { billing_type: 'conta_corrente', credit_limit: 3000 }
  const prepaid = lim.switchBillingModel({ ...initial }, 'pay_as_you_go', initial)
  assert.equal(lim.switchBillingModel(prepaid, 'conta_corrente', initial).credit_limit, 3000)
  assert.equal(lim.redactClientForViewer({ billing_type: 'pay_as_you_go', credit_limit: 80 }, 'client').credit_limit, 80, 'a prepaid store sees its own wallet')
  assert.equal(lim.redactClientForViewer({ billing_type: 'conta_corrente', credit_limit: 3000, credit_limit_enabled: true }, 'client').credit_limit, undefined)
})
