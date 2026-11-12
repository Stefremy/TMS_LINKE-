const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fetchOfficialShipmentLabel } = createLoader({})('lib/official-shipment-label.ts')

const officialPdf = Buffer.from('%PDF-1.4\nOriginal carrier fixture').toString('base64')
const shipment = { id: 'shipment-a', tracking_number: 'LTK1234567', carrier_tracking_number: 'CE000000001PT',
  carrier_code: 'ctt', status: 'pendente', ctt_label_base64: 'OLD-TMS-LABEL', labelBase64: 'OLD-TMS-LABEL' }

test('cached TMS labels are ignored and the saved official PDF is returned unchanged', async () => {
  const calls = []
  assert.equal(await fetchOfficialShipmentLabel(shipment, async id => { calls.push(id); return officialPdf }), officialPdf)
  assert.deepEqual(calls, [shipment.id])
})

test('unavailable official labels stay unavailable even when the row contains a cached label', async () => {
  assert.equal(await fetchOfficialShipmentLabel(shipment, async () => null), null)
  assert.equal(await fetchOfficialShipmentLabel(null, async () => { throw Error('Unexpected lookup') }), null)
})

test('failed lookups try other exact references once through the authorized action', async () => {
  const calls = []
  const result = await fetchOfficialShipmentLabel({ ...shipment, rawId: ' shipment-a ', ctt_object_id: shipment.carrier_tracking_number }, async id => {
    calls.push(id)
    if (id === shipment.id) throw Error('Fixture lookup failure')
    return id === shipment.tracking_number ? officialPdf : null
  }, [shipment.id, '', null])
  assert.equal(result, officialPdf)
  assert.deepEqual(calls, [shipment.id, shipment.carrier_tracking_number, shipment.tracking_number])
})

const flatten = node => Array.isArray(node) ? node.flatMap(flatten) :
  node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') :
  node && typeof node === 'object' ? textOf(node.props?.children) : String(node ?? '')

function menuHarness(t, dashboard, label, account = {}) {
  const slots = [], dependencies = [], effects = []
  let cursor = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useSyncExternalStore: (sub, get) => get(),
    useEffect(fn, deps) {
      const i = cursor++
      if (!dependencies[i] || deps.some((value, n) => !Object.is(value, dependencies[i][n]))) {
        dependencies[i] = deps
        effects.push(fn)
      }
    },
  }
  const calls = { lookups: [], downloads: [], prints: [], alerts: [], manifests: [], reprints: [] }
  const previous = { document: global.document, alert: global.alert }
  global.document = { addEventListener() {}, removeEventListener() {} }
  global.alert = message => calls.alerts.push(message)
  t.after(() => Object.assign(global, previous))
  const jsx = (type, props) => typeof type === 'function' && /^CttCertificate/.test(type.name) ? type(props) : ({ type, props: props || {} })
  const load = createLoader({
    fetch: async () => ({ ok: true, json: async () => ({ messages: [], unreadCount: 0 }) }),
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    'next/link': { __esModule: true, default: 'a' },
    '@/app/actions/shipments': {
      getShipmentLabelAction: async id => { calls.lookups.push(id); return label },
      getClientPortalStatsAction: async () => ({ totalCount: 1, totalRevenue: 4, deliveredCount: 0, deliveryRate: 0,
        walletBalance: account.walletBalance,
        weeklyVolume: [], destinationRegions: [], recentShipments: account.shipments || [shipment], allShipments: account.shipments || [shipment] }),
    },
    '@/app/actions/ctt': {},
    '@/app/actions/shipment-manifests': { downloadCttAcceptanceCertificateAction: async id => { calls.reprints.push(id); return account.manifestResponse || {success:false,error:'Fixture missing PDF'} }, generateCttAcceptanceCertificateAction: async ids => { calls.manifests.push(ids); return account.manifestResponse || { success: false, error: 'Fixture: no manifest generated during label tests' } } },
    '@/lib/label-utils': {
      downloadCttLabel: async (...args) => { calls.downloads.push(args); return true },
      printCttLabel: (...args) => { calls.prints.push(args); return true },
    },
    '@/lib/hooks/useTrackingPolling': { useTrackingPolling() {} },
    '@/components/shipments/ShipmentParcelWeight': { ShipmentParcelWeight: 'span' },
    '@/components/ui/badge': { Badge: 'span' },
    '@/app/ops/entidades/clientes/types': { DEFAULT_CTT_SERVICES_PRICING: [] },
    '@/app/app/components/ClientShipmentDetailModal': { ClientShipmentDetailModal: 'dialog' },
    '@/app/app/components/ClientTopUpModal': { ClientTopUpModal: 'dialog' },
    '@/lib/carrier-logos': { getCarrierLogo: () => null, getShipmentCarrierLogo: () => null },
    // Mensagens ao utilizador chegam por notificação (lib/notify); qualquer tipo conta como aviso mostrado.
    sonner: { toast: Object.assign(m => calls.alerts.push(m), { error: m => calls.alerts.push(m), warning: m => calls.alerts.push(m), info: m => calls.alerts.push(m), success: m => calls.alerts.push(m) }) },
    '@/lib/status-helpers': { getShipmentStatusConfig: () => ({ label: 'Pendente', badgeVariant: 'warning' }) },
    './ClientScope': { useClientScope: () => ({ client: { id: account.clientId || 'client-a', short_name: 'Fixture', pricing: {}, billing_type: account.billingType }, basePath: '/app/fixture' }) },
    './ClientMessages': { useClientMessageCounter: () => ({ unreadCount: 0, refresh: async () => {} }) },
    '@/components/manifest-documents': { ManifestDocuments: 'div' },
  })
  const Component = dashboard === 'history' ? load('app/app/components/ClientShipmentsHistory.tsx').ClientShipmentsHistory : dashboard ? load('app/app/components/ClientDashboard.tsx').ClientDashboard :
    load('app/ops/envios/components/ActionMenu.tsx').ActionMenu
  const render = () => {
    cursor = 0
    const nodes = flatten(dashboard ? Component() : Component({ shipment }))
    effects.splice(0).forEach(fn => fn())
    return nodes
  }
  const ready = async () => {
    render()
    await new Promise(resolve => setImmediate(resolve))
    return render()
  }
  return { calls, ready, async open() {
    const nodes = await ready()
    const icon = dashboard ? 'MoreVertical' : 'ChevronDown'
    nodes.find(n => n.type === 'button' && flatten(n.props.children).some(child => child.type === icon))
      .props.onClick({ stopPropagation() {} })
    return render()
  } }
}

test('overview: certificate action lives in Ações, then the row shows it was generated and reprints the saved original', async t => {
  const h = menuHarness(t, true, officialPdf, { manifestResponse: { success: true, manifestPdfBase64: officialPdf, documents: [{FileName: 'CertAceitResumo.pdf', File: officialPdf}] } })
  let nodes = await h.ready()
  assert.equal(nodes.some(n => n.type === 'input' && /^Selecionar envio CTT/.test(n.props['aria-label'] || '')), false)
  assert.equal(nodes.some(n => n.type === 'span' && textOf(n) === 'Certificado de aceitação gerado'), false)
  nodes = await h.open()
  await nodes.find(n => n.type === 'button' && textOf(n) === 'Gerar certificado de aceitação').props.onClick()
  assert.deepEqual(h.calls.manifests, [[shipment.id]])
  const after = await h.ready()
  assert.ok(after.some(n => n.type === 'span' && textOf(n) === 'Certificado de Aceitação CTT'))
  assert.ok(after.some(n => n.type === 'span' && textOf(n) === 'Certificado de aceitação gerado'))
  assert.equal(after.some(n => n.type === 'button' && /^Gerar certificado de aceitação/.test(n.props['aria-label'] || '')), false)
  const menu = await h.open()
  assert.equal(menu.some(n => n.type === 'button' && textOf(n) === 'Gerar certificado de aceitação'), false)
  await menu.find(n => n.type === 'button' && textOf(n) === 'Descarregar certificado de aceitação').props.onClick()
  assert.deepEqual(h.calls.reprints, [shipment.id]); assert.equal(h.calls.manifests.length, 1)
})

test('dashboard: conta corrente and legacy invoiced accounts never inherit a prepaid wallet block', async t => {
  for (const billingType of ['conta_corrente', undefined]) {
    for (const walletBalance of [undefined, -2, -20]) {
      const nodes = await menuHarness(t, true, officialPdf, { billingType, walletBalance }).ready()
      const status = nodes.find(n => n.type === 'div' && n.props.children?.some?.(child => textOf(child) === 'Estado da Conta'))
      assert.ok(status)
      assert.match(textOf(status), /Ativa \/ Regular/)
      assert.doesNotMatch(textOf(status), /Bloqueada/)
      assert.ok(nodes.some(n => n.type === 'a' && n.props.href === '/app/fixture/criar-guia'))
      assert.ok(!nodes.some(n => n.type === 'button' && textOf(n).includes('Novo Envio (Bloqueado)')))
    }
  }
})

test('dashboard: prepaid status and new-shipment button agree at the minus-two-euro boundary', async t => {
  for (const [walletBalance, blocked] of [[-2.01, true], [-2, true], [-1.99, false], [0, false]]) {
    const nodes = await menuHarness(t, true, officialPdf, { billingType: 'pay_as_you_go', walletBalance }).ready()
    const status = nodes.find(n => n.type === 'div' && n.props.children?.some?.(child => textOf(child) === 'Estado da Conta'))
    assert.ok(status)
    assert.equal(textOf(status).includes('Bloqueada (-2€)'), blocked)
    assert.equal(nodes.some(n => n.type === 'button' && textOf(n).includes('Novo Envio (Bloqueado)')), blocked)
  }
})

for (const dashboard of [true, false]) {
  const surface = dashboard ? 'client dashboard' : 'OPS menu'
  for (const print of [false, true]) {
    test(`${surface}: ${print ? 'print' : 'download'} uses the original carrier PDF instead of the cached TMS label`, async t => {
      const h = menuHarness(t, dashboard, officialPdf), nodes = await h.open()
      const title = print ? 'Imprimir Etiqueta' : dashboard ? 'Descarregar PDF' : 'Descarregar Etiqueta Oficial'
      await nodes.find(n => n.type === 'button' && textOf(n) === title).props.onClick()
      await new Promise(resolve => setImmediate(resolve))
      assert.deepEqual(h.calls.lookups, [shipment.id])
      assert.equal((print ? h.calls.prints : h.calls.downloads)[0][0], officialPdf)
      assert.deepEqual(h.calls.alerts, [])
    })
  }
  test(`${surface}: a missing official label produces a message and no download`, async t => {
    const h = menuHarness(t, dashboard, null), nodes = await h.open()
    const title = dashboard ? 'Descarregar PDF' : 'Descarregar Etiqueta Oficial'
    await nodes.find(n => n.type === 'button' && textOf(n) === title).props.onClick()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.calls.downloads.length, 0)
    assert.equal(h.calls.alerts.length, 1)
    assert.match(h.calls.alerts[0], /etiqueta oficial.*não está disponível/)
  })
}


test('only open CTT shipments can be closed: history by checked selection, overview one at a time',async t=>{
 for(const screen of [true,'history']){
  const second={...shipment,id:'shipment-b',tracking_number:'LTK-SECOND',carrier_tracking_number:'CE000000002PT'}
  const closed={...shipment,id:'closed',tracking_number:'LTK-CLOSED',ops_substatus:'manifesto_fechado'}
  const correos={...shipment,id:'correos',tracking_number:'CEX-DEMO',carrier_code:'correos',carrier_tracking_number:'1234567890123456'}
  const h=menuHarness(t,screen,officialPdf,{shipments:[shipment,second,closed,correos],manifestResponse:{success:true,manifestPdfBase64:officialPdf}})
  let nodes=await h.ready()
  const control=screen==='history'?(ref=>n=>n.type==='input'&&n.props['aria-label']===`Selecionar envio CTT ${ref}`):(ref=>n=>n.type==='button'&&n.props['aria-label']===`Gerar certificado de aceitação do envio ${ref}`)
  assert.equal(nodes.some(control('LTK-CLOSED')),false)
  assert.equal(nodes.some(control('CEX-DEMO')),false)
  if(screen==='history'){
   nodes.find(control('LTK-SECOND')).props.onChange()
   nodes=await h.ready()
   await nodes.find(n=>n.type==='button'&&textOf(n)==='Gerar certificado CTT (1)').props.onClick()
  } else await nodes.find(control('LTK-SECOND')).props.onClick()
  assert.deepEqual(h.calls.manifests,[[second.id]])
  nodes=await h.ready()
  assert.ok(nodes.some(control('LTK1234567')))
 }
})

test('failed generation does not mark a shipment closed',async t=>{
 const h=menuHarness(t,true,officialPdf)
 let nodes=await h.ready()
 await nodes.find(n=>n.type==='button'&&n.props['aria-label']==='Gerar certificado de aceitação do envio LTK1234567').props.onClick()
 nodes=await h.ready()
 assert.ok(nodes.some(n=>n.type==='button'&&n.props['aria-label']==='Gerar certificado de aceitação do envio LTK1234567'))
 assert.equal(nodes.some(n=>n.type==='span'&&textOf(n)==='Certificado de aceitação gerado'),false)
})
