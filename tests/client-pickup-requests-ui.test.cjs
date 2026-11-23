const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createLoader } = require('./helpers/load-typescript.cjs')
const client = { id: 'fixture', short_name: 'Loja A', address: 'Rua do Armazém 1', postal_code: '4000-001', city: 'Porto', phone: '912345678', email: 'loja@example.pt' }
const request = { id: '44444444-4444-4444-4444-444444444444', reference: 'PR-444444444444', client_id: client.id, client_name: client.short_name,
  status: 'pending', created_at: '2026-11-12T12:00:00Z', pickup: { date: '2099-12-01', period: '13:00-16:00', carrier: 'correos_express', volumes: 2, weightKg: 5, heaviestWeightKg: 3,
    name: client.short_name, address: client.address, city: client.city, postal: client.postal_code, contact: 'Ana', phone: client.phone, email: client.email, notes: 'Porta das traseiras' } }
const fields = { inputClass: 'input', primaryButton: 'primary', secondaryButton: 'secondary' }
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), zod: require('zod'), 'lucide-react': require('lucide-react'),
  'next/navigation': { useRouter: () => ({ refresh() {} }), usePathname: () => '/app/fixture/recolhas' },
  'next/link': { __esModule: true, default: ({ children, ...props }) => { delete props.prefetch; return React.createElement('a', props, children) } },
  '@/app/actions/client-pickup-requests': {}, '@/app/actions/client-pickup-locations': {}, '@/components/shipments/form/fields': fields,
}
const load = createLoader(mocks)
const { ClientScopeProvider } = load('app/app/components/ClientScope.tsx')
const { ClientRequestPickup } = load('app/app/components/ClientRequestPickup.tsx')
const page = status => ({ requests: [{ ...request, status }], total: 1, page: 0 })

test('client pickup page uses real store data, offers requests only and distinguishes pending from a booked pickup', () => {
  for (const status of ['pending', 'completed']) {
    const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client, basePath: '/app/fixture', isEmployee: false } }, React.createElement(ClientRequestPickup, { initialPage: page(status) })))
    for (const text of ['Enviar pedido à Linke', 'Rua do Armazém 1', '4000-001', 'PR-444444444444', 'não confirma o levantamento da mercadoria']) assert.ok(html.includes(text), text)
    assert.match(html, status === 'completed' ? /Efetuado<\/span>/ : /Pendente<\/span>/)
    assert.doesNotMatch(html, /O estafeta CTT passará|Confirmar Pedido de Recolha CTT|REC-CTT-/)
  }
})

test('client pickup form prefers the pickup contact details and keeps the store name', () => {
  const pickupClient = { ...client, pickup_contact_name: 'Marta', pickup_mobile_phone: '+351 922222222', mobile_phone: '911111111' }
  const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client: pickupClient } }, React.createElement(ClientRequestPickup)))
  assert.match(html, /name="name" value="Loja A"/)
  assert.match(html, /name="contact" value="Marta"/)
  assert.match(html, /name="phone" value="\+351 922222222"/)
})

test('the saved default address and its contact are prefilled when the client reopens Recolhas', () => {
  const location = { id: 'south', label: 'Armazém Sul', name: 'Loja Sul', address: 'Rua Sul, 1',
    postal: '1100-001', city: 'Lisboa', contact: 'Inês', phone: '931234567', email: '' }
  const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client } },
    React.createElement(ClientRequestPickup, { initialLocations: [location], initialDefaultLocationId: location.id })))
  assert.match(html, /<option value="south" selected="">Armazém Sul · 1100-001 Lisboa \(padrão\)<\/option>/)
  assert.match(html, /name="address" value="Rua Sul, 1"/)
  assert.match(html, /name="contact" value="Inês"/)
  assert.match(html, /Usar morada principal como padrão/)
})

test('Ops queue: pending requests can be prepared or cancelled; only a request in treatment can record a carrier reference', () => {
  const { ClientPickupRequestsPanel } = load('app/ops/envios/recolhas/ClientPickupRequestsPanel.tsx')
  const html = renderToStaticMarkup(React.createElement(ClientPickupRequestsPanel, { initialPage: page('pending'), onSchedule() {} }))
  for (const text of ['Pedidos dos clientes (1)', 'Preparar recolha', 'Cancelar pedido', 'Porta das traseiras', '912345678']) assert.ok(html.includes(text), text)
  for (const text of ['Marcar efetuado', 'Registar referência', 'Referência confirmada']) assert.ok(!html.includes(text), text)
  const claimed = renderToStaticMarkup(React.createElement(ClientPickupRequestsPanel, { initialPage: page('processing'), onSchedule() {} }))
  assert.match(claimed, /Em tratamento/); assert.match(claimed, /Repor pendente após verificação/); assert.match(claimed, /Registar referência/); assert.match(claimed, /Referência confirmada/)
  assert.doesNotMatch(claimed, /Preparar recolha/); assert.doesNotMatch(claimed, /Cancelar pedido/)
})

test('pickup requests are discoverable in the shared desktop and mobile client menu', () => {
  const { ClientSidebarNav } = load('app/app/components/ClientSidebarNav.tsx')
  const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client, basePath: '/app/fixture' } }, React.createElement(ClientSidebarNav)))
  assert.match(html, /href="\/app\/fixture\/recolhas"/); assert.match(html, /Pedir recolha/)
})

const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []

test('the portal can select a saved pickup site for each request or use the primary address', () => {
  const slots = []; let cursor = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn) { return fn() },
  }
  const jsx = (type, props, key) => ({ type, props: props || {}, key })
  const isolated = createLoader({ ...mocks, react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './ClientScope': { useClientScope: () => ({ client }) },
    './ClientPickupLocationAgenda': { ClientPickupLocationAgenda: 'agenda', PickupAddressFields: 'pickup-address' },
  })
  const { ClientRequestPickup } = isolated('app/app/components/ClientRequestPickup.tsx')
  const north = { id: 'north', label: 'Armazém Norte', name: 'Loja Norte', address: 'Rua Norte, 1', city: 'Braga',
    postal: '4700-001', contact: 'Ana', phone: '924567890', email: '' }
  const south = { ...north, id: 'south', label: 'Armazém Sul', address: 'Rua Sul, 1', city: 'Lisboa', postal: '1100-001' }
  const render = () => { cursor = 0; return flatten(ClientRequestPickup({ initialLocations: [north, south] })) }
  const select = () => render().find(node => node.props.name === 'pickupLocation')
  const address = () => render().find(node => node.type === 'pickup-address').props.values
  const choose = id => select().props.onChange({ target: { value: id } })
  const agenda = () => render().find(node => node.type === 'agenda').props

  assert.equal(select().props.value, 'primary')
  assert.equal(address().address, client.address)
  assert.equal(render().filter(node => node.type === 'option' && ['north', 'south'].includes(node.props.value)).length, 2)
  choose('north')
  assert.equal(address(), north)
  choose('south')
  assert.equal(address(), south)
  choose('manual')
  assert.equal(address(), undefined)
  agenda().onDefaultChanged(south.id)
  assert.equal(select().props.value, 'manual')

  choose('south')
  assert.equal(address(), south)
  agenda().onDefaultChanged(north.id)
  assert.equal(address(), north)
  agenda().onRemoved(north.id)
  assert.equal(select().props.value, 'primary')
  assert.equal(address().address, client.address)
})

test('the Envios pickup modal sends the primary pickup address and contact in the booking', async () => {
  const slots = []; let cursor = 0; const calls = []
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = value }] } }
  const jsx = (type, props) => ({ type, props: props || {} })
  const isolated = createLoader({ ...mocks, react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/app/actions/ctt': { scheduleCttPickupAction: async input => { calls.push(input); return { Success: true } } },
  })
  const { NovaRecolhaModal } = isolated('app/ops/envios/components/NovaRecolhaModal.tsx')
  const pickupClient = { ...client, name: client.short_name, postal_code: '28001', city: 'Madrid', country_code: 'ES',
    pickup_contact_name: 'Marta', pickup_mobile_phone: '922222222' }
  const render = () => { cursor = 0; return flatten(NovaRecolhaModal({ clients: [pickupClient], onClose() {} })) }
  render().find(node => node.type === 'select').props.onChange({ target: { value: client.id } })
  const form = render()
  assert.equal(form.find(node => node.props.placeholder === 'Pessoa a contactar').props.value, 'Marta')
  assert.equal(form.find(node => node.props.placeholder === 'Nº Contacto').props.value, '922222222')
  await form.find(node => node.type === 'button' && node.props.children === 'Agendar Recolha').props.onClick()
  assert.equal(calls[0].sender.name, 'Loja A')
  assert.equal(calls[0].sender.contact, 'Marta')
  assert.equal(calls[0].sender.phone, '922222222')
  assert.equal(calls[0].sender.address, pickupClient.address)
  assert.equal(calls[0].sender.zip, '28001')
  assert.equal(calls[0].sender.city, 'Madrid')
  assert.equal(calls[0].sender.country, 'ES')
})

test('Ops prefills new bookings from the profile and uses the submitted contact for client requests', async t => {
  const slots = []; let cursor = 0; const calls = []
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] }, useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } } }
  const jsx = (type, props) => ({ type, props: props || {} })
  const isolated = createLoader({ ...mocks, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': new Proxy({}, { get: (_, key) => key }),
    '@/app/actions/ctt': { scheduleCttPickupAction: () => { throw Error('Client requests must use guarded scheduling') } },
    '@/app/actions/client-pickup-requests': { scheduleClientPickupRequestAction: async (...args) => { calls.push(args); return { success: true, pickupNumber: 'CEX-FIXTURE', carrier_name: 'Correos Express' } } },
    './PickupManagement': { PickupDetailsDialog: () => null, PickupSearchPanel: () => null },
    './PickupCutoffNotice': { PickupCutoffNotice: () => null }, './PickupStatus': { PickupStatus: () => null },
    './ClientPickupRequestsPanel': { ClientPickupRequestsPanel: function Requests() {} },
  })
  const { RecolhasClient } = isolated('app/ops/envios/recolhas/RecolhasClient.tsx')
  const pickupClient = { ...client, code: 'A', name: client.short_name, pickup_contact_name: 'Marta', pickup_mobile_phone: '922222222' }
  const render = () => { cursor = 0; return flatten(RecolhasClient({ recolhas: [], clients: [pickupClient], carrierConnections: [{ id: 'correos', carrier_code: 'correos_express' }], clientRequests: page('pending') })) }
  const button = label => render().find(node => node.type === 'button' && [node.props.children].flat().some(child =>
    typeof child === 'string' && child.trim() === label))
  button('Nova Recolha').props.onClick()
  render().find(node => node.type === 'select' && flatten(node.props.children).some(option => option.props.value === client.id)).props.onChange({ target: { value: client.id } })
  let form = render()
  assert.equal(form.find(node => node.props.placeholder === 'Nome de quem entrega').props.value, 'Marta')
  assert.equal(form.find(node => node.props.name === 'pickupMobilePhone').props.value, '922222222')
  assert.equal(form.find(node => node.props.name === 'pickupPhone').props.value, '')
  assert.equal(form.find(node => node.props.placeholder === 'Rua Principal, 100').props.value, client.address)
  assert.equal(form.find(node => node.props.placeholder === '0000-000').props.value, client.postal_code)
  assert.equal(form.find(node => node.props.placeholder === 'Porto').props.value, client.city)

  button('Pedidos dos clientes').props.onClick()
  render().find(node => node.type?.name === 'Requests').props.onSchedule(request)
  form = render()
  for (const [name, value] of [['senderName', client.short_name], ['senderAddress', client.address], ['senderZip', client.postal_code]]) {
    assert.ok(form.some(node => node.type === 'input' && node.props.value === value), name)
  }
  const previous = { FormData: global.FormData, window: global.window }, events = []
  global.window = { dispatchEvent: event => events.push(event.type) }
  global.FormData = class { get(name) { return { pickupPhone: client.phone, pickupMobilePhone: '', requesterName: 'Linke', requesterPhone: '912345678', requesterMobile: '' }[name] || '' } }
  t.after(() => { global.FormData = previous.FormData; global.window = previous.window })
  await form.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} })
  assert.equal(calls.length, 1); assert.equal(calls[0][0], request.id)
  assert.equal(calls[0][1].client_id, client.id); assert.equal(calls[0][1].volumes, 2); assert.equal(calls[0][1].weightKg, 5)
  assert.equal(calls[0][1].sender.contact, 'Ana'); assert.equal(calls[0][1].sender.phone, client.phone)
  assert.equal(calls[0][1].sender.address, client.address); assert.equal(calls[0][1].observations, 'Porta das traseiras')
  assert.ok(events.includes('linke:pickup-requests-changed'))
})
