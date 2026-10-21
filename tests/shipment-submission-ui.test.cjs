const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const client = { id: 'store-a', short_name: 'Fixture A', legal_name: 'Fixture A',
  allowed_webservices: [], assigned_linke_service_ids: ['service-a'], pricing: {} }
const service = { id: 'service-a', name: 'CTT Fixture', zones: [], is_active: true }
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) :
  node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') :
  node && typeof node === 'object' ? textOf(node.props?.children) : String(node ?? '')
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function hooks() {
  const slots = [], dependencies = [], cleanup = [], effects = new Map()
  let cursor = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo: callback => callback(),
    useEffect(callback, deps) {
      const i = cursor++
      if (!dependencies[i] || deps.some((value, n) => !Object.is(value, dependencies[i][n]))) {
        dependencies[i] = deps
        effects.set(i, () => { cleanup[i]?.(); cleanup[i] = callback() })
      }
    },
  }
  return { react, render(callback) { cursor = 0; return callback() },
    commit() { const current = [...effects.values()]; effects.clear(); current.forEach(callback => callback()) },
    dispose() { cleanup.forEach(callback => callback?.()) } }
}
function harness(t, portal) {
  const h = hooks(), result = deferred(), calls = { create: 0, agenda: [], scroll: [] }
  const previous = { window: global.window, document: global.document, FormData: global.FormData }
  global.window = { matchMedia: () => ({ matches: false }) }
  global.document = { getElementById: () => ({ focus() {} }) }
  global.FormData = class {
    get(name) { return ({ recipient_name: 'Fixture recipient', recipient_address: 'Fixture street',
      recipient_zip: '4000-001', recipient_city: 'Porto', weight_kg: '1', volumes: '1' })[name] || '' }
  }
  t.after(() => { h.dispose(); Object.assign(global, previous) })
  const jsx = (type, props) => ({ type, props: props || {} })
  const load = createLoader({
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/link': { __esModule: true, default: 'a' },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' },
    '@/app/actions/shipments': { emitClientGuiaAction: () => { calls.create++; return result.promise } },
    '@/app/actions/servicos-linke': { getServicosLinkeAction: async () => [service] },
    '@/app/actions/destinatarios': { getDestinatariosAction: async id => { calls.agenda.push(id); return [] } },
    '@/app/actions/ctt': {}, '@/lib/label-utils': {},
    '@/lib/pricing/calculate-shipment-price': { resolveZoneCode: () => 'PT-CONT', isZoneAllowedByService: () => true },
    '@/lib/pricing/calculate-shipment-quote': { getClientSpecialFees: () => [], calculateShipmentQuote: () => ({
      basePrice: 8, buyPrice: 3, fuelSurchargeAmount: 1, specialFeesAmount: 0, specialItems: [], totalPrice: 9, tierLabel: 'Fixture',
    }) },
    '@/app/ops/entidades/clientes/types': { SYSTEM_AVAILABLE_WEBSERVICES: [] },
    '@/lib/services/ctt/service-identity': { getServiceDisplayLabel: () => 'CTT Fixture' },
    '@/lib/carrier-logos': { getCarrierLogo: () => null },
    '@/lib/services/geo/international-zones': { OFFICIAL_LINKE_ZONES: [] },
    '@/lib/hooks/usePostalCodeLookup': { usePostalCodeLookup: () => ({ lookup: value => value, loading: false }) },
    './ClientScope': { useClientScope: () => ({ client, basePath: '/app/fixture-a' }) },
  })
  const Component = portal ? load('app/app/components/ClientCreateGuia.tsx').ClientCreateGuia :
    load('app/ops/envios/novo/NovoEnvioPageClient.tsx').NovoEnvioPageClient
  const render = () => {
    const nodes = flatten(h.render(() => portal ? Component() : Component({ clients: [client], servicosLinke: [service] })))
    for (const node of nodes) {
      if (node.props.ref && node.props.ref.current === null) node.props.ref.current =
        { scrollIntoView: options => calls.scroll.push(options), reset() {} }
    }
    h.commit()
    return nodes
  }
  return { calls, result, render, async ready() {
    render()
    await new Promise(resolve => setImmediate(resolve))
    let nodes = render()
    if (portal) nodes.find(node => node.props.id === 'field-recipient-name').props.onChange({ target: { value: 'Fixture recipient' } })
    return render()
  } }
}
for (const portal of [true, false]) {
  const name = portal ? 'client portal' : 'OPS'
  test(name + ': rapid double submit sends one request, shows loading, then scrolls to success and unlocks', async t => {
    const h = harness(t, portal), nodes = await h.ready()
    assert.deepEqual(h.calls.agenda, [], 'Opening the form must not load the full recipient history')
    const form = nodes.find(node => node.type === 'form')
    const first = form.props.onSubmit({ preventDefault() {}, currentTarget: {} })
    await form.props.onSubmit({ preventDefault() {}, currentTarget: {} })
    assert.equal(h.calls.create, 1)
    const pending = h.render().find(node => node.props.type === 'submit')
    assert.equal(pending.props.disabled, true)
    assert.match(textOf(pending), /A criar envio/)
    assert.equal(h.calls.scroll.length, 0)
    h.result.resolve({ success: true, id: 'shipment-a', guia: 'EQ-FIXTURE', sellPrice: 9 })
    await first
    const complete = h.render().find(node => node.props.type === 'submit')
    assert.equal(complete.props.disabled, false)
    assert.equal(h.calls.scroll.length, 1)
    assert.deepEqual(h.calls.scroll[0], { behavior: 'smooth', block: 'start' })
  })
  test(name + ': failed creation unlocks the form without scrolling or retrying automatically', async t => {
    const h = harness(t, portal), nodes = await h.ready()
    const submission = nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} })
    h.result.reject(new Error('Simulated carrier timeout'))
    await submission
    const after = h.render()
    assert.equal(after.find(node => node.props.type === 'submit').props.disabled, false)
    assert.equal(h.calls.create, 1)
    assert.equal(h.calls.scroll.length, 0)
    assert.match(after.map(textOf).join(' '), /Simulated carrier timeout/)
  })
}
test('recipient agenda loads on demand and discards a late response from a different store', async () => {
  const h = hooks(), requests = [], responses = [deferred(), deferred()]
  const load = createLoader({
    react: h.react,
    '@/app/actions/destinatarios': { getDestinatariosAction: id => {
      const index = requests.length; requests.push(id); return responses[index].promise
    } },
  })
  const { useRecipientAgenda } = load('lib/hooks/useRecipientAgenda.ts')
  const render = (id, open) => { const state = h.render(() => useRecipientAgenda(id, open)); h.commit(); return state }
  render('store-a', false)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, [])
  render('store-a', true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, ['store-a'])
  assert.equal(render('store-b', true).recipients.length, 0)
  await new Promise(resolve => setImmediate(resolve))
  responses[1].resolve([{ id: 'b', name: 'Store B contact' }])
  await new Promise(resolve => setImmediate(resolve))
  responses[0].resolve([{ id: 'a', name: 'Store A contact' }])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(render('store-b', true).recipients.map(row => row.id), ['b'])
  h.dispose()
})
