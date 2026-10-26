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

test('client service names omit product identities, transit promises and internal pricing profiles', () => {
  const load = createLoader({})
  const { getClientServiceName, getClientServiceLabel } = load('lib/services/client-service-label.ts')
  for (const [name, expected] of [
    ['Ctt expresso # (VIP / Alto Volume)', 'Ctt expresso #'],
    ['Linke Ibérico 24H (Correos Paq 24)', 'Linke Ibérico'],
    ['CTT 24/48 horas (Premium D+1)', 'CTT'],
    ['Guia EQ · Económico 48 — Ctt expresso #', 'Ctt expresso #'],
    ['Tabela 24 (Loja Norte)', 'Tabela 24 (Loja Norte)'],
    ['CTT Para Amanhã', 'CTT'],
  ]) assert.equal(getClientServiceName(name), expected)
  const selected = { name: 'Ctt expresso # (VIP / Alto Volume)', category: 'Nacional',
    preferred_carrier_name: 'CTT Expresso', webservice_service_code: 'ENCF008.01', transit_time_label: '48h' }
  const before = JSON.stringify(selected)
  assert.equal(getClientServiceLabel(selected), '[Nacional] Ctt expresso #')
  assert.equal(getClientServiceLabel({ name: '[Nacional] CTT Em 2 Dias (48H) — Guia DB', category: 'Nacional' }), '[Nacional] CTT')
  assert.match(load('lib/services/ctt/service-identity.ts').getServiceDisplayLabel(selected), /Guia EQ · Económico 48/)
  assert.equal(JSON.stringify(selected), before)
})

test('client selector shows every assigned table simply and submits the unchanged service identity', async t => {
  const services = [
    { ...service, name: 'Ctt expresso # (VIP / Alto Volume)', category: 'Nacional',
      transit_time_label: '48h', description: 'Internal negotiated volume discount' },
    { ...service, id: 'service-b', name: 'Correos 24H', category: 'Ibérico', transit_time_label: '24h' },
  ]
  const h = harness(t, true, services), nodes = await h.ready()
  const options = nodes.filter(n => n.type === 'option' && services.some(s => s.id === n.props.value))
  assert.deepEqual(options.map(textOf), ['[Nacional] Ctt expresso #', '[Ibérico] Correos'])
  assert.doesNotMatch(nodes.map(textOf).join(' '), /Internal negotiated volume discount|48h|Alto Volume/)
  const submission = nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} })
  assert.equal(h.calls.inputs[0].serviceId, services[0].id)
  assert.equal(h.calls.inputs[0].serviceName, services[0].name)
  h.result.resolve({ success: true, id: 'shipment-a', guia: 'EQ-FIXTURE', sellPrice: 9 })
  await submission
})
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
function harness(t, portal, services = [service]) {
  const h = hooks(), result = deferred(), calls = { create: 0, agenda: [], scroll: [], inputs: [] }
  const scopedClient = { ...client, assigned_linke_service_ids: services.map(s => s.id) }
  const previous = { window: global.window, document: global.document, FormData: global.FormData }
  global.window = { matchMedia: () => ({ matches: false }) }
  global.document = { getElementById: () => ({ focus() {} }) }
  global.FormData = class {
    get(name) { return ({ recipient_name: 'Fixture recipient', recipient_address: 'Fixture street',
      recipient_zip: '4000-001', recipient_city: 'Porto', weight_kg: '1', volumes: '1', length_cm: '30.5', width_cm: '20', height_cm: '10' })[name] || '' }
  }
  t.after(() => { h.dispose(); Object.assign(global, previous) })
  const jsx = (type, props) => ({ type, props: props || {} })
  const load = createLoader({
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/link': { __esModule: true, default: 'a' },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' },
    '@/app/actions/shipments': { emitClientGuiaAction: input => { calls.create++; calls.inputs.push(input); return result.promise } },
    '@/app/actions/servicos-linke': { getServicosLinkeAction: async () => services },
    '@/app/actions/destinatarios': { getDestinatariosAction: async id => { calls.agenda.push(id); return [] } },
    '@/app/actions/ctt': {}, '@/lib/label-utils': {},
    '@/lib/pricing/calculate-shipment-price': { resolveZoneCode: () => 'PT-CONT', isZoneAllowedByService: () => true },
    '@/lib/pricing/calculate-shipment-quote': { getClientSpecialFees: () => [], calculateShipmentQuote: () => ({
      basePrice: 8, buyPrice: 3, fuelSurchargeAmount: 1, specialFeesAmount: 0, specialItems: [], totalPrice: 9, tierLabel: 'Fixture',
    }) },
    '@/lib/pricing/calculate-client-shipment-preview': { calculateClientShipmentPreview: () => ({
      basePrice: 8, fuelSurchargeAmount: 1, specialFeesAmount: 0, specialItems: [], totalPrice: 9,
    }) },
    '@/app/ops/entidades/clientes/types': { SYSTEM_AVAILABLE_WEBSERVICES: [] },
    '@/lib/services/ctt/service-identity': { getServiceDisplayLabel: () => 'CTT Fixture' },
    '@/lib/carrier-logos': { getCarrierLogo: () => null },
    '@/lib/services/geo/international-zones': { OFFICIAL_LINKE_ZONES: [] },
    '@/lib/hooks/usePostalCodeLookup': { usePostalCodeLookup: () => ({ lookup: value => value, loading: false }) },
    './ClientScope': { useClientScope: () => ({ client: scopedClient, basePath: '/app/fixture-a', isSuspended: false }) },
  })
  const Component = portal ? load('app/app/components/ClientCreateGuia.tsx').ClientCreateGuia :
    load('app/ops/envios/novo/NovoEnvioPageClient.tsx').NovoEnvioPageClient
  const render = () => {
    const nodes = flatten(h.render(() => portal ? Component() : Component({ clients: [scopedClient], servicosLinke: services })))
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
    if (portal) {
      nodes.find(node => node.props.id === 'field-recipient-name').props.onChange({ target: { value: 'Fixture recipient' } })
      for (const [id, value] of [['field-length-cm', '30.5'], ['field-width-cm', '20'], ['field-height-cm', '10']]) {
        nodes.find(node => node.props.id === id).props.onChange({ target: { value } })
      }
    }
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
    assert.deepEqual([h.calls.inputs[0].lengthCm, h.calls.inputs[0].widthCm, h.calls.inputs[0].heightCm], [30.5, 20, 10])
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
  test(name + ': all three parcel dimensions are required, positive and accept decimals', async t => {
    const h = harness(t, portal), nodes = await h.ready()
    for (const name of ['length_cm', 'width_cm', 'height_cm']) {
      const field = nodes.find(node => node.type === 'input' && node.props.name === name)
      assert.ok(field, `${name} must be present`)
      assert.equal(field.props.required, true)
      assert.equal(Number(field.props.min), 0.1)
      assert.equal(field.props.step, 'any')
    }
  })
  test(name + ': a storage warning after acceptance is visible and never suggests creating the parcel again', async t => {
    const h = harness(t, portal), nodes = await h.ready()
    const submission = nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} })
    h.result.resolve({ success: true, id: 'shipment-a', guia: 'EQ-FIXTURE', sellPrice: 9, dbWarning: 'Confirme a gravação do volume.' })
    await submission
    const message = h.render().map(textOf).join(' ')
    assert.match(message, /Confirme a gravação do volume/)
    assert.match(message, /Não volte a criar este envio/)
    assert.doesNotMatch(message, /crie novamente/)
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
