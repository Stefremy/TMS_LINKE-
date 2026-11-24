const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const client = { id: 'store-a', short_name: 'Fixture A', legal_name: 'Fixture A',
  allowed_webservices: [], assigned_linke_service_ids: ['service-a'], pricing: {}, address:'Armazém de recolha',postal_code:'4800-019',city:'Guimarães',country_code:'PT',billing_same_as_pickup:false,billing_address:'Sede fiscal',billing_postal_code:'4000-001',billing_city:'Porto',billing_country_code:'PT' }
const service = { id: 'service-a', name: 'CTT Fixture', allowed_zones: ['PT-CONT'], is_active: true,
  zones: [{zone_code:'PT-CONT',tiers:[{weight_max:30,sell_price:8,cost_price:3,enabled:true}]}] }
const destinations = createLoader({})('lib/services/service-destinations.ts')
const flatten = node => node?.type?.name === 'ShipmentVolumetricSummary' ? flatten(node.type(node.props)) : Array.isArray(node) ? node.flatMap(flatten) :
  node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') :
  node && typeof node === 'object' ? textOf(node.props?.children) : String(node ?? '')

test('client service names preserve Paq product names while omitting transit promises and internal pricing profiles', () => {
  const load = createLoader({})
  const { getClientServiceName, getClientServiceLabel } = load('lib/services/client-service-label.ts')
  for (const [name, expected] of [
    ['Ctt expresso # (VIP / Alto Volume)', 'Ctt expresso #'],
    ['Linke Paq 24 PT', 'Linke Paq 24 PT'],
    ['Linke Paq 48 ES', 'Linke Paq 48 ES'],
    ['Linke e-Paq 24 B2C (Correos Express)', 'Linke e-Paq 24 B2C (Correos Express)'],
    ['Linke Ibérico 24H (Correos Paq 24)', 'Linke Ibérico (Correos Paq 24)'],
    ['Linke Ibérico (Correos Paq 48)', 'Linke Ibérico (Correos Paq 48)'],
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
