const test = require('node:test'), assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { invoiceRecipient, withInvoiceRecipient, normalizeClientBillingFields, FINAL_CONSUMER_NIF } = createLoader({})('lib/client-addresses.ts')

const client = { nif: '215476581', legal_name: 'TESTE FRM, Lda', short_name: 'TESTE FRM', address: 'Rua A', postal_code: '4800-019', city: 'Guimarães', country_code: 'PT' }
const separate = { billing_same_as_pickup: false, billing_address: 'Rua B', billing_postal_code: '4800-019', billing_city: 'Guimarães', billing_country_code: 'PT' }

test('without a billing NIF the invoice uses the client NIF and legal name', () => {
  assert.deepEqual(invoiceRecipient(client), { nif: '215476581', name: 'TESTE FRM, Lda', finalConsumer: false })
  assert.deepEqual(invoiceRecipient({ ...client, ...separate }), { nif: '215476581', name: 'TESTE FRM, Lda', finalConsumer: false })
})

test('final consumer button value invoices to 999999990 as "Consumidor final"', () => {
  const r = invoiceRecipient({ ...client, ...separate, billing_nif: FINAL_CONSUMER_NIF })
  assert.deepEqual(r, { nif: '999999990', name: 'Consumidor final', finalConsumer: true })
  const named = withInvoiceRecipient({ ...client, ...separate, billing_nif: FINAL_CONSUMER_NIF, billing_name: 'João Silva' })
  assert.equal(named.nif, '999999990'); assert.equal(named.legal_name, 'João Silva'); assert.equal(named.short_name, 'TESTE FRM')
})

test('another valid NIF is used only while the separate billing address is on', () => {
  const other = { ...client, ...separate, billing_nif: '501234560', billing_name: 'Outra Empresa, SA' }
  assert.deepEqual(invoiceRecipient(other), { nif: '501234560', name: 'Outra Empresa, SA', finalConsumer: false })
  assert.equal(invoiceRecipient({ ...other, billing_same_as_pickup: true }).nif, '215476581')
  assert.equal(invoiceRecipient({ ...client, ...separate, billing_nif: '501234560' }).name, 'TESTE FRM, Lda')
})

test('billing NIF is cleaned and an invalid one is refused before saving', () => {
  assert.equal(normalizeClientBillingFields({ ...separate, billing_nif: ' PT 501 234 560 ' }).billing_nif, '501234560')
  assert.equal(normalizeClientBillingFields({ ...separate, billing_nif: '999999990' }).billing_nif, '999999990')
  assert.equal(normalizeClientBillingFields(separate).billing_nif, '')
  assert.throws(() => normalizeClientBillingFields({ ...separate, billing_nif: '123456780' }), /NIF de faturação 123456780 não é válido/)
})

test('Moloni lookup never reuses another client record for the shared final-consumer NIF', async () => {
  const { MoloniClient } = createLoader({ '@/lib/moloni/app-credentials': { moloniAppCredentials: () => ({}) } })('lib/moloni/moloni-client.ts')
  const moloni = Object.create(MoloniClient.prototype)
  const records = { '999999990': [{ customer_id: 1, name: 'Consumidor final' }, { customer_id: 2, name: 'Outra Loja' }], '501234560': [{ customer_id: 3, name: 'X' }] }
  moloni.request = async (_path, { vat }) => records[vat] || []
  assert.equal(await moloni.getCustomerByVat('999999990'), null)
  assert.equal(await moloni.getCustomerByVat('999999990', 'Loja Nova'), null)
  assert.equal((await moloni.getCustomerByVat('999999990', 'consumidor  FINAL')).customer_id, 1)
  assert.equal((await moloni.getCustomerByVat('501234560')).customer_id, 3)
})
