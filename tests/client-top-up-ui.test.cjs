const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createLoader } = require('./helpers/load-typescript.cjs')

const load = createLoader({ react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react') })
const { ClientScopeProvider } = load('app/app/components/ClientScope.tsx')
const { ClientCarregamentosHistory } = load('app/app/components/ClientCarregamentosHistory.tsx')
const { ClientTopUpModal } = load('app/app/components/ClientTopUpModal.tsx')
const client = { id: 'fixture', short_name: 'Loja', credit_limit: 9187 }
const transactions = [{ id: 'historical-payment', client_id: client.id, amount: 25, status: 'paid', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' }]
const render = (Component, props, billingType) => renderToStaticMarkup(React.createElement(ClientScopeProvider, {
  value: { client: { ...client, billing_type: billingType }, basePath: '/app/fixture', isEmployee: false },
}, React.createElement(Component, props)))

test('conta corrente and legacy accounts retain history without wallet balances or top-up controls', () => {
  for (const billingType of ['conta_corrente', undefined]) for (const rows of [[], transactions]) {
    const html = render(ClientCarregamentosHistory, { transactions: rows }, billingType)
    assert.match(html, /Os seus envios são faturados em conta corrente/)
    assert.doesNotMatch(html, /Novo carregamento|Carregar Saldo Agora|Carregar carteira|Saldo disponível|9[.,]?187|role="dialog"/)
    if (rows.length) { assert.match(html, /25,00/); assert.match(html, /Confirmado/) }
  }
})

test('prepaid accounts keep their wallet and top-up controls with and without existing transactions', () => {
  for (const rows of [[], transactions]) {
    const html = render(ClientCarregamentosHistory, { transactions: rows }, 'pay_as_you_go')
    assert.match(html, /Novo carregamento/)
    assert.match(html, /Saldo disponível/)
    if (!rows.length) assert.match(html, /Carregar Saldo Agora/)
  }
})

test('an open top-up modal renders only for the prepaid client in the current portal scope', () => {
  const props = { isOpen: true, onClose() {}, clientId: client.id }
  for (const billingType of ['conta_corrente', undefined]) assert.equal(render(ClientTopUpModal, props, billingType), '')
  assert.equal(render(ClientTopUpModal, { ...props, clientId: 'other-client' }, 'pay_as_you_go'), '')
  assert.equal(renderToStaticMarkup(React.createElement(ClientTopUpModal, props)), '')
  const html = render(ClientTopUpModal, props, 'pay_as_you_go')
  assert.match(html, /role="dialog"/)
  assert.match(html, /carteira pré-paga/)
  assert.doesNotMatch(html, /conta corrente/)
})
