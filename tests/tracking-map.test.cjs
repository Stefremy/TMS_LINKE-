const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createLoader } = require('./helpers/load-typescript.cjs')

function harness() {
  const queries = []
  const load = createLoader({
    '@/lib/services/geo/geocoder': {
      resolveCoordinates: async input => {
        queries.push(input)
        return { lat: 39.5, lng: -8.5, name: input.city }
      },
    },
  })
  return {
    ...load('app/ops/tracking/checkpoints.ts'),
    ...load('app/ops/tracking/map-points.ts'),
    ...load('app/ops/tracking/distances.ts'),
    ...load('lib/services/geo/coordinates.ts'),
    queries,
  }
}

const options = {
  destination: { lat: 37.019, lng: -7.93, name: 'Faro', district: 'Faro' },
  delivered: false,
  country: 'PT',
}
const scan = (description, event_code = 'TRN', timestamp = '2026-10-15T10:39:08+00:00') => ({ description, event_code, timestamp })

test('real five-scan sequence retains history without a fabricated Porto stop', async () => {
  const h = harness()
  const events = [
    scan('Chegada ao Nó Cliente (Nó Cliente)', 'EMO'),
    scan('Recolha Efetuada (C. O. BRAGA)', 'EMP'),
    scan('Recepção Nacional (C. O. BRAGA)', 'EMB'),
    scan('Transferência entre Centros Operacionais | Razão: Razão 1 | Situação: Sem situação (C. O. BRAGA)', 'TRA'),
    scan('Expedição Nacional (C.O. BRAGA (OBR))', 'EMF'),
  ]
  const checkpoints = await h.buildTrackingCheckpoints(events, options)
  assert.equal(checkpoints.length, 5)
  assert.deepEqual(checkpoints.map(p => p.description), events.map(e => e.description))
  assert.equal(checkpoints[0].locationName, 'Nó Cliente')
  assert.equal(checkpoints[0].lat, null)
  assert.equal(checkpoints[0].lng, null)
  const mapped = h.getMappedCheckpoints(checkpoints)
  assert.equal(mapped.length, 4)
  assert.ok(mapped.every(p => p.city === 'Braga'))
  assert.ok(mapped.every(p => !p.locationName.includes('Porto')))
  assert.deepEqual(h.queries, [], 'all named Braga facilities resolve locally, including nested OBR suffix')
  assert.equal(mapped.at(-1).isCurrentPosition, true)
  assert.equal(checkpoints[0].formattedTime, '11:39')
})

test('generic customer node variants are never submitted to a geographic search', async () => {
  const h = harness()
  for (const location_name of ['Nó Cliente', 'No Cliente', 'Nó de Cliente', ' NÓ CLIENTE ']) {
    const [p] = await h.buildTrackingCheckpoints([{ location_name, event_code: 'EMO' }], options)
    assert.equal(p.lat, null)
    assert.equal(h.resolveLocationCoordinate(location_name).lat, 39.5)
  }
  assert.deepEqual(h.queries, [])
})

test('an explicitly named Porto centre still appears on the map', async () => {
  const h = harness()
  const [p] = await h.buildTrackingCheckpoints([scan('Recepção Nacional (C.O. PORTO)')], options)
  assert.equal(h.hasCheckpointLocation(p), true)
  assert.equal(p.city, 'Porto')
  assert.deepEqual(h.queries, [])
})

test('a location-less scan never borrows the sender or previous checkpoint coordinates', async () => {
  const h = harness()
  const checkpoints = await h.buildTrackingCheckpoints([
    scan('Recepção Nacional (C. O. BRAGA)'),
    scan('Em trânsito'),
  ], options)
  assert.equal(checkpoints[1].lat, null)
  assert.equal(checkpoints[1].locationName, 'Local não indicado')
  assert.equal(checkpoints[1].isCurrentPosition, true)
  assert.equal(h.getMappedCheckpoints(checkpoints).at(-1).id, checkpoints[0].id)
  assert.deepEqual(h.queries, [])
})

test('an unresolvable named location is retained without a map point', async () => {
  const h = harness()
  const [p] = await h.buildTrackingCheckpoints([scan('Passagem (Centro desconhecido 999)')], options)
  assert.equal(p.lat, null)
  assert.equal(p.locationName, 'Centro desconhecido 999')
  assert.equal(h.queries.length, 1)
})

test('delivery uses the destination while an unsuccessful delivery does not', async () => {
  const h = harness()
  const [delivered] = await h.buildTrackingCheckpoints([scan('Entregue', 'EMI')], { ...options, delivered: true })
  assert.equal(delivered.lat, options.destination.lat)
  assert.equal(delivered.status, 'completed')
  const [failed] = await h.buildTrackingCheckpoints([scan('Não entregue - destinatário ausente', 'EMH')], options)
  assert.equal(failed.lat, null)
})

test('an explicitly stored facility takes precedence over the description', async () => {
  const h = harness()
  const [p] = await h.buildTrackingCheckpoints([
    { ...scan('Em trânsito'), location_name: 'C. O. BRAGA' },
  ], options)
  assert.equal(p.city, 'Braga')
  assert.equal(h.hasCheckpointLocation(p), true)
})

test('missing timestamps are not replaced with an invented reading time', async () => {
  const h = harness()
  const [p] = await h.buildTrackingCheckpoints([{ description: 'Em trânsito' }], options)
  assert.equal(p.formattedTime, '—')
})

test('map filtering rejects absent or invalid coordinates and accepts existing demo points', () => {
  const h = harness()
  const points = [
    { lat: null, lng: null }, { lat: NaN, lng: 0 }, { lat: 91, lng: 0 },
    { lat: 41.442, lng: -8.291 },
  ]
  assert.deepEqual(h.getMappedCheckpoints(points), [points[3]])
  const origin = h.resolveLocationCoordinate('Guimarães')
  assert.equal(origin.name, 'Guimarães')
  assert.equal(origin.district, 'Braga')
})

for (const pagePath of ['app/ops/tracking/page.tsx', 'app/app/[storeSlug]/tracking/page.tsx']) {
test(`${pagePath} sends real scans, Guimarães locality and geographic distances to the client`, async () => {
  const React = require('react')
  const load = createLoader({
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { __esModule: true, default: () => null },
    'next/navigation': { redirect(url) { throw new Error(`redirect:${url}`) }, notFound() { throw new Error('notFound') } },
    '@/lib/auth/ops-page-access': { requireOpsPageAccess: async () => {} },
    '@/app/actions/clientes': { getClientesAction: async () => [] },
    './components/DeliveryTrackingClient': { DeliveryTrackingClient: () => null },
    '@/app/ops/tracking/components/DeliveryTrackingClient': { DeliveryTrackingClient: () => null },
    '@/lib/client-portal/access': { requirePortalStore: async () => ({
      client: { id: 'client-test' }, basePath: '/app/test',
    }) },
    '@/app/actions/shipments': { getShipmentsAction: async () => [{
      id: 'shipment-test', client_id: 'client-test', tracking_number: 'LTK-TEST', status: 'em_transito',
      sender_address: 'Morada de teste, Guimarães', sender_zip4: '4800', sender_zip3: '019',
    }] },
    '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({
      select() { return this },
      in(column, ids) { assert.equal(column, 'shipment_id'); assert.deepEqual(ids, ['shipment-test']); return this },
      order: async () => ({ data: [
        { shipment_id: 'shipment-test', ...scan('Chegada ao Nó Cliente (Nó Cliente)', 'EMO') },
        { shipment_id: 'shipment-test', ...scan('Expedição Nacional (C.O. BRAGA (OBR))', 'EMF') },
      ] }),
    }) }) },
    '@/lib/services/geo/geocoder': { resolveCoordinates: async ({ address }) => address
      ? { lat: 41.442, lng: -8.291, name: 'Guimarães', district: 'Braga' }
      : options.destination },
  })
  const Page = load(pagePath).default
  const tree = await Page({ params: Promise.resolve({ storeSlug: 'test' }), searchParams: Promise.resolve({ search: 'LTK-TEST' }) })
  function findProps(node) {
    if (!node || typeof node !== 'object') return null
    if (node.props?.initialShipments) return node.props
    for (const child of React.Children.toArray(node.props?.children)) {
      const found = findProps(child)
      if (found) return found
    }
    return null
  }
  const props = findProps(tree)
  assert.equal(props.initialShipments.length, 1)
  const shipment = props.initialShipments[0]
  assert.equal(shipment.origin.city, 'Guimarães')
  assert.equal(shipment.pickagens.length, 2)
  assert.equal(shipment.pickagens[0].lat, null)
  assert.equal(shipment.pickagens[1].city, 'Braga')
  assert.ok(shipment.metrics.totalDistanceKm > 450 && shipment.metrics.totalDistanceKm < 550)
  assert.ok(shipment.metrics.remainingDistanceKm > 450 && shipment.metrics.remainingDistanceKm < 550)
  assert.notEqual(shipment.metrics.totalDistanceKm, shipment.metrics.remainingDistanceKm)
})
}

test('great-circle calculation agrees with the known London to Paris distance', () => {
  const { distanceKm } = harness()
  const km = distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 })
  assert.ok(Math.abs(km - 343.56) < 0.1)
})

test('remaining distance uses the latest located scan, skipping unlocated and future scans', () => {
  const h = harness()
  const origin = { lat: 41.442, lng: -8.291 }
  const destination = options.destination
  const latest = { lat: 38.722, lng: -9.139, status: 'current' }
  const distances = h.buildTrackingDistances(origin, destination, [
    { ...origin, status: 'completed' }, latest,
    { lat: null, lng: null, status: 'current' },
    { ...destination, status: 'pending' },
  ], false)
  assert.equal(distances.totalDistanceKm, h.distanceKm(origin, destination))
  assert.equal(distances.remainingDistanceKm, h.distanceKm(latest, destination))
  assert.ok(distances.remainingDistanceKm < distances.totalDistanceKm)
})

test('without located scans distance falls back to origin; unknown coordinates stay unavailable', () => {
  const h = harness()
  const origin = { lat: 41.442, lng: -8.291 }
  const unknown = { lat: 39.5, lng: -8.5 }
  const distances = h.buildTrackingDistances(origin, options.destination, [{ lat: null, lng: null }], false)
  assert.equal(distances.remainingDistanceKm, distances.totalDistanceKm)
  assert.equal(h.buildTrackingDistances(origin, unknown, [], false).remainingDistanceKm, null)
  assert.equal(h.buildTrackingDistances(unknown, options.destination, [], false).remainingDistanceKm, null)
  assert.equal(h.distanceKm({ lat: NaN, lng: 0 }, origin), null)
  assert.equal(h.distanceKm({ lat: 91, lng: 0 }, origin), null)
  assert.equal(h.distanceKm({ lat: 40.416, lng: -3.703, district: 'Espanha' }, origin), null)
  assert.ok(h.buildTrackingDistances(unknown, options.destination, [{ ...origin, status: 'current' }], false).remainingDistanceKm > 0)
})

test('confirmed delivery is zero even without coordinates; a return still uses its known location', () => {
  const h = harness()
  const origin = { lat: 41.442, lng: -8.291 }
  const unknown = { lat: 39.5, lng: -8.5 }
  assert.equal(h.buildTrackingDistances(unknown, unknown, [], true).remainingDistanceKm, 0)
  assert.ok(h.buildTrackingDistances(origin, options.destination, [], false).remainingDistanceKm > 0)
})

test('distance card distinguishes unavailable, delivered, nearby and estimated distances', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const load = createLoader({
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': require('lucide-react'),
  })
  const { MapSummaryBar } = load('app/ops/tracking/components/MapSummaryBar.tsx')
  for (const [distance, expected] of [[null, 'Indisponível'], [0, '0 km'], [0.2, '&lt; 1 km'], [343.56, '≈ 344 km']]) {
    const html = renderToStaticMarkup(React.createElement(MapSummaryBar, {
      shipment: { origin: {}, metrics: { remainingDistanceKm: distance } },
    }))
    assert.ok(html.includes(expected), html)
    if (distance > 0) assert.match(html, /Em linha reta/)
    if (distance === null) assert.doesNotMatch(html, /0 km/)
  }
})

test('timeline explains the unlocated reading without removing it', async () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const h = harness()
  const pickagens = await h.buildTrackingCheckpoints([
    scan('Chegada ao Nó Cliente (Nó Cliente)', 'EMO'),
    scan('Recolha Efetuada (C. O. BRAGA)', 'EMP'),
  ], options)
  const load = createLoader({
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': require('lucide-react'),
  })
  const { DeliveryProgressPanel } = load('app/ops/tracking/components/DeliveryProgressPanel.tsx')
  const shipment = {
    pickagens, metrics: { completedScansCount: 2, totalScansCount: 4, progressPercent: 50 },
    origin: {}, destination: {}, cargo: {},
  }
  const html = renderToStaticMarkup(React.createElement(DeliveryProgressPanel, { shipment }))
  assert.match(html, /Localização não indicada pela transportadora/)
  assert.match(html, /Nó Cliente/)
  assert.match(html, /1 com localização/)
  assert.doesNotMatch(html, /Porto Norte/)
})
