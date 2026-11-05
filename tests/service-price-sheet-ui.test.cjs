const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const flat = n => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : []
const text = n => Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.props?.children) : String(n ?? '')

function harness(t, fetch) {
  const slots = [], downloads = []
  let cursor = 0
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } }, useEffect() {},
  }
  const previousDocument = global.document, previousCreate = URL.createObjectURL
  global.document = { createElement: () => ({ click() { downloads.push({ name: this.download, url: this.href }) }, remove() {} }), body: { appendChild() {} } }
  URL.createObjectURL = () => 'blob:price-sheet-test'
  t.after(() => { global.document = previousDocument; URL.createObjectURL = previousCreate })
  const jsx = (type, props) => ({ type, props: props || {} })
  const load = createLoader({ react, fetch, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    './DestinationIcons': { DestinationBadge: 'span' }, '@/components/ctt-service-badge': { CttServiceBadge: 'span' },
    '@/lib/carrier-logos': { getCarrierLogo: () => null },
  })
  const { TabelasLinkeTab } = load('app/ops/configuracao/servicos/components/TabelasLinkeTab.tsx')
  const service = { id: 'srv_linke_multiplo_std', code: 'LK-MULT-STD', name: 'Linke Múltiplo', category: 'Nacional', is_active: true,
    pricing_profile: 'Standard / Geral', allowed_zones: ['PT-CONT'], zones: [{ zone_code: 'PT-CONT', tiers: [{ weight_max: 1, sell_price: 3.33, cost_price: 2 }] }] }
  const render = () => { cursor = 0; return flat(TabelasLinkeTab({ servicos: [service], canManageBaseTables: false, canManageCreatedTables: true })) }
  return { render, downloads }
}

test('customer PDF button sits beside create variant, works on a protected base table and downloads once on rapid clicks', async t => {
  let resolve, calls = 0, requested
  const pending = new Promise(yes => { resolve = yes })
  const h = harness(t, (url, options) => { calls++; requested = { url, options }; return pending })
  let nodes = h.render()
  const buttons = nodes.filter(n => n.type === 'button')
  const index = buttons.findIndex(n => text(n) === 'Criar variante')
  assert.equal(text(buttons[index + 1]), 'PDF para cliente')
  assert.ok(nodes.some(n => text(n).includes('Apenas consulta')))
  const click = buttons[index + 1].props.onClick
  const first = click()
  await click()
  assert.equal(calls, 1)
  assert.equal(requested.url, '/api/servicos-linke/srv_linke_multiplo_std/pdf')
  assert.equal(requested.options.cache, 'no-store')
  nodes = h.render()
  assert.equal(nodes.find(n => n.type === 'button' && text(n) === 'A gerar PDF...').props.disabled, true)
  resolve(new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="linke-cliente.pdf"' } }))
  await first
  assert.deepEqual(h.downloads, [{ name: 'linke-cliente.pdf', url: 'blob:price-sheet-test' }])
  assert.equal(h.render().find(n => n.type === 'button' && text(n) === 'PDF para cliente').props.disabled, false)
})

test('failed exports show the server validation message and remain retryable without downloading an error page', async t => {
  let calls = 0
  const h = harness(t, async () => ++calls === 1 ? new Response('Sem destinos autorizados.', { status: 422 }) : new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }))
  const click = () => h.render().find(n => n.type === 'button' && text(n) === 'PDF para cliente').props.onClick()
  await click()
  assert.ok(h.render().some(n => n.props.role === 'alert' && text(n) === 'Sem destinos autorizados.'))
  await click()
  assert.ok(h.render().some(n => n.props.role === 'alert' && text(n).includes('sessão expirou')))
  assert.equal(calls, 2)
  assert.equal(h.downloads.length, 0)
})
