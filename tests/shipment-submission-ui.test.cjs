const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const client = { id: 'store-a', short_name: 'Fixture A', legal_name: 'Fixture A',
  allowed_webservices: [], assigned_linke_service_ids: ['service-a'], pricing: {} }
const service = { id: 'service-a', name: 'CTT Fixture', allowed_zones: ['PT-CONT'], is_active: true,
  zones: [{zone_code:'PT-CONT',tiers:[{weight_max:30,sell_price:8,cost_price:3,enabled:true}]}] }
const destinations = createLoader({})('lib/services/service-destinations.ts')
const flatten = node => node?.type?.name === 'ShipmentVolumetricSummary' ? flatten(node.type(node.props)) : Array.isArray(node) ? node.flatMap(flatten) :
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
    useCallback: callback => callback,
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
function harness(t, portal, services = [service], realQuotes = false, configuredSpecialFees = []) {
  const h = hooks(), result = deferred(), calls = { create: 0, agenda: [], scroll: [], inputs: [], postalResets: 0 }
  const scopedClient = { ...client, assigned_linke_service_ids: services.map(s => s.id) }
  const previous = { window: global.window, document: global.document, FormData: global.FormData }
  global.window = { matchMedia: () => ({ matches: false }) }
  global.document = { getElementById: () => ({ focus() {} }) }
  global.FormData = class {
    get(name) { return ({ recipient_name: 'Fixture recipient', recipient_address: 'Fixture street',
      recipient_zip: '4000-001', recipient_city: 'Porto', weight_kg: '1', volumes: '1', length_cm: '30.5', width_cm: '20', height_cm: '10',
      ctt_export_type:'Permanent',ctt_content_type:'Goods',ctt_declared_value:'25' })[name] || '' }
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
    '@/lib/pricing/chargeable-weight': createLoader({})('lib/pricing/chargeable-weight.ts'),
    '@/lib/services/service-destinations': destinations,
    '@/lib/services/shipment-service-options': createLoader({})('lib/services/shipment-service-options.ts'),
    '@/lib/pricing/calculate-shipment-quote': realQuotes ? createLoader({})('lib/pricing/calculate-shipment-quote.ts') : { isCorreosLinkeService: () => false, getClientSpecialFees: () => configuredSpecialFees, calculateShipmentQuote: () => ({
      basePrice: 8, buyPrice: 3, fuelSurchargeAmount: 1, specialFeesAmount: 0, specialItems: [], totalPrice: 9, tierLabel: 'Fixture',
    }) },
    '@/lib/pricing/calculate-client-shipment-preview': realQuotes ? createLoader({})('lib/pricing/calculate-client-shipment-preview.ts') : { calculateClientShipmentPreview: () => ({
      basePrice: 8, fuelSurchargeAmount: 1, specialFeesAmount: 0, specialItems: [], totalPrice: 9,
    }) },
    '@/app/ops/entidades/clientes/types': { SYSTEM_AVAILABLE_WEBSERVICES: [] },
    '@/lib/services/ctt/service-identity': { getServiceDisplayLabel: () => 'CTT Fixture' },
    '@/lib/carrier-logos': { getCarrierLogo: () => null },
    '@/lib/services/geo/international-zones': { OFFICIAL_LINKE_ZONES: [] },
    '@/lib/hooks/usePostalCodeLookup': { usePostalCodeLookup: () => ({ lookup: value => value, loading: false, reset(){calls.postalResets++} }) },
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
    nodes=render()
    if(portal){
      const country=nodes.find(n=>n.type==='select'&&n.props.name==='recipient_country')
      const codes=flatten(country).filter(n=>n.type==='option'&&n.props.value).map(n=>n.props.value)
      if(codes.length){
        const iso=codes.includes('PT')?'PT':codes.includes('BE')?'BE':codes[0]
        country.props.onChange({target:{value:iso}});nodes=render()
        const postal=iso==='PT'?(services.some(s=>s.zones.some(z=>z.zone_code==='PT-CONT'))?'4000-001':'9000-001'):iso==='BE'?'1000':'75001'
        nodes.find(n=>n.props.id==='field-recipient-postal').props.onChange({target:{value:postal}})
        nodes=render();nodes=render()
        const selector=nodes.find(n=>n.type==='select'&&n.props['aria-label']==='Serviço de Transporte Linke')
        const first=flatten(selector).find(n=>n.type==='option'&&n.props.value)
        if(first&&!selector.props.value)selector.props.onChange({target:{value:first.props.value}})
      }
    }
    render()
    return render()
  } }
}
for (const portal of [true, false]) {
  const name = portal ? 'client portal' : 'OPS'
  test(`${name}: changing island dimensions immediately moves to the maritime weight tier`,async t=>{
    const maritime={...service,webservice_service_code:'EMSF057.01',preferred_carrier_name:'CTT Expresso',fuel_surcharge_pct:0,allowed_zones:['PT-ILHAS'],
      zones:[{zone_code:'PT-ILHAS',zone_name:'Ilhas',tiers:[10,15,30,40].map(kg=>({id:String(kg),label:`Até ${kg} kg`,weight_max:kg,sell_price:kg,cost_price:kg/2,enabled:true}))}]}
    const h=harness(t,portal,[maritime],true)
    let nodes=await h.ready()
    const change=(predicate,value)=>{nodes.find(predicate).props.onChange({target:{value}});nodes=h.render()}
    change(n=>portal?n.props.id==='field-recipient-postal':n.props.name==='recipient_zip','9000-001')
    change(n=>n.props.name==='weight_kg','10')
    for(const [field,value] of [['length','50'],['width','40'],['height','40']]){
      change(n=>n.props.id===(portal?`field-${field}-cm`:`ops-${field}-cm`),value)
    }
    assert.match(nodes.map(textOf).join(' '),/Peso usado na tarifa: 26,667 kg/)
    assert.match(nodes.map(textOf).join(' '),/Divisor do serviço: 3000/)
    const summary=nodes.findIndex(n=>n.props.role==='status'&&n.props.className?.includes('d8e6db'))
    assert.ok(summary>nodes.findIndex(n=>n.props.id===(portal?'field-height-cm':'ops-height-cm')))
    if(portal)assert.ok(summary<nodes.findIndex(n=>n.type==='label'&&textOf(n).includes('Observações')))
    assert.equal(h.calls.create,0)
    change(n=>n.props.id===(portal?'field-height-cm':'ops-height-cm'),'10')
    assert.match(nodes.map(textOf).join(' '),/Peso usado na tarifa: 10 kg/)
  })
  for(const [phone,email,allowed] of [
    ['32470123456','',true],['+32 470 123 456','',true],['+3222792211','recipient@example.invalid',true],
    ['+3222792211','',false],['','',false],
  ]) test(`${name}: Belgian CTT contacts ${phone || 'empty'}/${email ? 'email' : 'no email'} ${allowed ? 'can submit' : 'stop locally'}`,async t=>{
    const {buildOfficialCeTruckZones}=createLoader({})('lib/services/geo/international-zones.ts')
    const road={...service,name:'CTT Europa Terrestre',webservice_service_code:'ENCF008.02',allowed_zones:['Zona 2','Zona 3'],zones:buildOfficialCeTruckZones()}
    const h=harness(t,portal,[road])
    let nodes=await h.ready()
    nodes.find(n=>n.type==='select'&&n.props.name==='recipient_country').props.onChange({target:{value:'BE'}})
    nodes=h.render()
    if(portal){nodes.find(n=>n.props.id==='field-recipient-postal').props.onChange({target:{value:'1000'}});nodes=h.render()}
    nodes.find(n=>n.props.name==='recipient_phone').props.onChange({target:{value:phone}})
    nodes.find(n=>n.props.name==='recipient_email').props.onChange({target:{value:email}})
    nodes=h.render()
    assert.equal(nodes.find(n=>n.props.name==='recipient_email').props.required,!phone.includes('470'))
    const submission=nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}})
    assert.equal(h.calls.create,allowed?1:0)
    if(allowed){
      assert.equal(h.calls.inputs[0].recipientPhone,phone)
      assert.equal(h.calls.inputs[0].recipientEmail,email || (portal?'':undefined))
      h.result.resolve({success:false,error:'Fixture result; no real carrier call'})
    }
    await submission
    if(!allowed)assert.match(h.render().map(textOf).join(' '),/indique um e-mail ou telemóvel/)
  })
  test(name + ': destination and service selection follow the intended portal or OPS flow', async t => {
    const international={...service,id:'service-intl',name:'International',allowed_zones:['EU 1','NA'],
      zones:[{zone_code:'EU 1',tiers:[{weight_max:30,enabled:true}]},{zone_code:'NA',tiers:[{weight_max:30,enabled:true}]}]}
    const h=harness(t,portal,[service,international])
    let nodes=await h.ready()
    const country=()=>nodes.find(n=>n.type==='select'&&n.props.name==='recipient_country')
    const options=()=>flatten(country()).filter(n=>n.type==='option').map(n=>n.props.value).filter(Boolean)
    const selectService=id=>portal
      ? nodes.find(n=>n.type==='select'&&n.props['aria-label']==='Serviço de Transporte Linke').props.onChange({target:{value:id}})
      : nodes.find(n=>n.type==='input'&&n.props.name==='service_type'&&n.props.value===id).props.onChange()
    const serviceIndex=nodes.findIndex(n=>portal?n.props['aria-label']==='Serviço de Transporte Linke':n.props.name==='service_type')
    if(portal){
      assert.ok(serviceIndex>nodes.indexOf(country()))
      assert.ok(options().includes('PT'));assert.ok(options().includes('FR'))
      country().props.onChange({target:{value:'FR'}});nodes=h.render()
      assert.equal(nodes.find(n=>n.props.id==='field-recipient-postal').props.value,'')
      assert.equal(nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke').props.disabled,true)
      nodes.find(n=>n.props.id==='field-recipient-postal').props.onChange({target:{value:'75001'}})
      h.render();nodes=h.render()
      assert.equal(nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke').props.value,international.id)
      assert.equal(nodes.find(n=>n.props.id==='field-recipient-name').props.value,'Fixture recipient')
      selectService(international.id);nodes=h.render()
      assert.equal(country().props.value,'FR')
      assert.equal(nodes.find(n=>n.props.id==='field-recipient-postal').props.value,'75001')
      return
    }
    assert.ok(serviceIndex<nodes.indexOf(country()))
    assert.deepEqual(options(),['PT'])
    selectService(international.id);h.render();nodes=h.render()
    assert.equal(country().props.value,'')
    assert.equal(options().includes('US'),false);assert.ok(options().includes('FR'))
    assert.equal(options().includes('PT'),false);assert.equal(options().includes('ES'),false)
    country().props.onChange({target:{value:'FR'}});nodes=h.render()
    const postal=nodes.find(n=>portal?n.props.id==='field-recipient-postal':n.props.name==='recipient_zip')
    postal.props.onChange({target:{value:'75001'}})
    nodes=h.render();assert.equal(country().props.value,'FR')
    selectService(service.id);h.render();nodes=h.render()
    assert.deepEqual(options(),['PT']);assert.equal(country().props.value,'PT')
    assert.equal(nodes.find(n=>portal?n.props.id==='field-recipient-postal':n.props.name==='recipient_zip').props.value,'')
    assert.ok(h.calls.postalResets>0)
  })
  test(name + ': a service without configured destinations cannot be submitted',async t=>{
    const h=harness(t,portal,[{...service,zones:[]}]);const nodes=await h.ready()
    assert.equal(nodes.find(n=>n.type==='select'&&n.props.name==='recipient_country').props.disabled,true)
    await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}})
    assert.equal(h.calls.create,0)
    assert.match(h.render().map(textOf).join(' '),/Sem destinos configurados|países de destino com tarifas/)
  })
  test(name + ': customs destinations are absent from both shipping selectors',async t=>{
    const international={...service,name:'International air',webservice_service_code:'EMSF001.02',allowed_zones:['EU 2'],
      zones:[{zone_code:'EU 2',tiers:[{weight_max:30,enabled:true}]}]}
    const h=harness(t,portal,[international])
    const nodes=await h.ready()
    const selector=nodes.find(n=>n.type==='select'&&n.props.name==='recipient_country')
    const countries=flatten(selector).filter(n=>n.type==='option').map(n=>n.props.value)
    for(const country of ['IS','GB','NO','CH','US'])assert.equal(countries.includes(country),false,country)
    assert.ok(countries.filter(Boolean).length > 0)
  })
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

test('changing service or country invalidates pending and in-flight postal lookups',async t=>{
  const h=hooks(),response=deferred(),found=[]
  t.mock.timers.enable({apis:['setTimeout']})
  let requests=0
  const load=createLoader({react:h.react,fetch:()=>{requests++;return response.promise}})
  const {usePostalCodeLookup}=load('lib/hooks/usePostalCodeLookup.ts')
  const render=country=>h.render(()=>usePostalCodeLookup({country,onFound:info=>found.push(info)}))
  let lookup=render('PT')
  lookup.lookup('4000-001');lookup.reset();t.mock.timers.tick(350)
  assert.equal(requests,0)
  lookup.lookup('4000-001');t.mock.timers.tick(350);assert.equal(requests,1)
  lookup=render('FR');lookup.reset()
  response.resolve({ok:true,json:async()=>({found:true,city:'Porto',country:'PT'})})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(found,[])
  lookup=render('FR');assert.equal(lookup.info,null);assert.equal(lookup.status,'idle');assert.equal(lookup.loading,false)
  h.dispose()
})

test('international postal assistance fills a city and clears stale suggestions when typing again', async t => {
  const h = hooks(), found = [], requests = []
  t.mock.timers.enable({apis:['setTimeout']})
  const load = createLoader({react:h.react,fetch:async url => {
    requests.push(url)
    return {ok:true,json:async()=>({found:true,country:'BE',postalCode:'1000',city:'Bruxelles'})}
  }})
  const {usePostalCodeLookup} = load('lib/hooks/usePostalCodeLookup.ts')
  const render = () => {const result=h.render(()=>usePostalCodeLookup({country:'BE',onFound:info=>found.push(info)}));h.commit();return result}
  let lookup = render()
  lookup.lookup('100');t.mock.timers.tick(350)
  assert.equal(requests.length,0)
  lookup.lookup('1000');t.mock.timers.tick(350)
  await new Promise(resolve=>setImmediate(resolve))
  lookup = render()
  assert.equal(found[0].city,'Bruxelles')
  assert.equal(lookup.status,'valid')
  assert.match(requests[0],/country=BE/)
  lookup.lookup('10')
  lookup = render()
  assert.equal(lookup.info,null)
  assert.equal(lookup.status,'idle')
  assert.equal(lookup.loading,false)
  h.dispose()
})

test('postal assistance cancels requests on unmount and ignores late responses', async t => {
  const h = hooks(), response = deferred(), found = []
  t.mock.timers.enable({apis:['setTimeout']})
  const {usePostalCodeLookup} = createLoader({react:h.react,fetch:()=>response.promise})('lib/hooks/usePostalCodeLookup.ts')
  const lookup=h.render(()=>usePostalCodeLookup({country:'FR',onFound:info=>found.push(info)}))
  h.commit()
  lookup.lookup('75001');t.mock.timers.tick(350)
  h.dispose()
  response.resolve({ok:true,json:async()=>({found:true,country:'FR',city:'Paris'})})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(found,[])
})

test('client portal: island mode follows redacted product metadata, filters variants and preserves recipient data',async t=>{
 const make=(id,zone,island_transport_mode)=>({...service,id,name:id,carrier_group:'ctt',island_transport_mode,allowed_zones:[zone],zones:[{zone_code:zone,tiers:[{weight_max:30,sell_price:8,cost_price:3,enabled:true}]}]})
 const h=harness(t,true,[make('Continente','PT-CONT','other'),make('Ilhas Avião','PT-ILHAS','air'),make('Ilhas Barco','PT-ILHAS','sea')])
 let nodes=await h.ready()
 const change=(find,value)=>{nodes.find(find).props.onChange({target:{value}});nodes=h.render();nodes=h.render()}
 const selector=()=>nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke')
 const offered=()=>flatten(selector()).filter(n=>n.type==='option'&&n.props.value).map(n=>n.props.value)
 assert.deepEqual(offered(),['Continente'])
 change(n=>n.props.id==='field-recipient-address','Rua de teste 12')
 change(n=>n.props.id==='field-recipient-postal','9000-001')
 assert.equal(selector().props.value,'')
 assert.equal(selector().props.disabled,true)
 const radios=nodes.filter(n=>n.type==='input'&&n.props.name==='island_transport_mode')
 assert.deepEqual(radios.map(n=>n.props.value),['air','sea'])
 change(n=>n.props.name==='island_transport_mode'&&n.props.value==='air','air')
 assert.deepEqual(offered(),['Ilhas Avião'])
 assert.equal(selector().props.value,'Ilhas Avião')
 change(n=>n.props.name==='island_transport_mode'&&n.props.value==='sea','sea')
 assert.deepEqual(offered(),['Ilhas Barco'])
 assert.equal(nodes.find(n=>n.props.id==='field-recipient-address').props.value,'Rua de teste 12')
 assert.equal(nodes.find(n=>n.props.id==='field-recipient-postal').props.value,'9000-001')
 change(n=>n.props.id==='field-recipient-postal','4000-001')
 assert.deepEqual(offered(),['Continente'])
 assert.equal(nodes.some(n=>n.props.name==='island_transport_mode'),false)
 assert.equal(nodes.find(n=>n.props.id==='field-recipient-name').props.value,'Fixture recipient')
 assert.equal(h.calls.create,0)
})

test('client portal: incomplete postal codes never offer a mainland tariff and single island mode is automatic',async t=>{
 const s={...service,id:'Ilhas',name:'Ilhas',island_transport_mode:'sea',allowed_zones:['PT-ILHAS'],zones:[{zone_code:'PT-ILHAS',tiers:[{weight_max:30,enabled:true}]}]}
 const h=harness(t,true,[s]);let nodes=await h.ready()
 assert.equal(nodes.find(n=>n.props.name==='island_transport_mode').props.checked,true)
 assert.equal(nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke').props.value,'Ilhas')
 nodes.find(n=>n.props.id==='field-recipient-postal').props.onChange({target:{value:'9000'}});nodes=h.render()
 assert.equal(nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke').props.disabled,true)
 assert.equal(nodes.find(n=>n.props['aria-label']==='Serviço de Transporte Linke').props.value,'')
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}})
 assert.equal(h.calls.create,0)
})

for(const portal of [true,false])test(`${portal?'client portal':'OPS'}: return authorization disappears and is not submitted after changing mainland to islands`,async t=>{
 const s={...service,webservice_service_code:'EMSF056.01',preferred_carrier_name:'CTT Expresso',allowed_zones:['PT-CONT','PT-ILHAS'],zones:['PT-CONT','PT-ILHAS'].map(zone_code=>({zone_code,tiers:[{weight_max:30,sell_price:8,enabled:true}]}))}
 const fee={special_service_code:'auth_return',special_service_name:'AuthorizeReturn / Back',is_enabled:true,fee_type:'fixed',fixed_value:3.85,description:'Apenas continente'}
 const h=harness(t,portal,[s],false,[fee]);let nodes=await h.ready()
 if(!portal){nodes.find(n=>n.props.name==='recipient_zip').props.onChange({target:{value:'4000-001'}});nodes=h.render()}
 const option=nodes.find(n=>portal?n.props.id==='opt_auth_return':n.type==='div'&&n.props.onClick&&n.props.className?.includes('cursor-pointer')&&textOf(n).includes('Apenas continente'))
 assert.ok(option)
 if(portal)option.props.onChange({target:{checked:true}});else option.props.onClick()
 nodes=h.render()
 nodes.find(n=>portal?n.props.id==='field-recipient-postal':n.props.name==='recipient_zip').props.onChange({target:{value:'9000-001'}})
 nodes=h.render();nodes=h.render()
 assert.equal(nodes.some(n=>portal?n.props.id==='opt_auth_return':n.type==='div'&&n.props.onClick&&textOf(n).includes('Apenas continente')),false)
 const submission=nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{}})
 assert.equal(h.calls.create,1)
 assert.deepEqual(h.calls.inputs[0].selectedSpecialServices,[])
 h.result.resolve({success:false,error:'Test: no real provider call'})
 await submission
})
