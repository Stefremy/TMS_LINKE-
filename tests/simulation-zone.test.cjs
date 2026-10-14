const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { findSimulationZone, getSimulationZoneName } = createLoader({})('lib/pricing/simulation-zone.ts')

test('an unnamed nonmatching zone does not prevent finding the selected destination', () => {
  const continental = { zone_code: 'PT-CONT', tiers: [] }
  assert.equal(findSimulationZone([{ zone_code: 'EU-Z1' }, continental], 'PT-CONT'), continental)
  assert.equal(getSimulationZoneName(continental), 'PT-CONT')
})

test('legacy names and European aliases remain supported', () => {
  for (const code of ['EU 1', 'EU-Z1', 'EU-ZONA1']) {
    const zone = { zone_code: code, name: 'Europa', tiers: [] }
    assert.equal(findSimulationZone([zone], 'EU 1'), zone)
    assert.equal(getSimulationZoneName(zone), 'Europa')
  }
  const legacy = { name: 'Portugal Continental (PT-CONT)', tiers: [] }
  assert.equal(findSimulationZone([legacy], 'PT-CONT'), legacy)
})

test('an exact destination code takes precedence over a name mentioning that code', () => {
  const exact = { zone_code: 'PT-CONT', zone_name: 'Portugal Continental', tiers: [] }
  assert.equal(findSimulationZone([
    { zone_code: 'OTHER', zone_name: 'Former PT-CONT tariff', tiers: [] }, exact,
  ], 'PT-CONT'), exact)
})

test('short destination codes do not match parts of other zones or words', () => {
  const zones = [{ zone_code: 'SA', zone_name: 'América do Sul' }, { zone_name: 'EU 10' }]
  assert.equal(findSimulationZone(zones, 'A'), undefined)
  assert.equal(findSimulationZone(zones, 'EU 1'), undefined)
})

test('missing or malformed zone data is ignored safely', () => {
  for (const zones of [undefined, null, {}, [null, undefined, { zone_name: 123 }, { zone_code: 456 }]]) {
    assert.equal(findSimulationZone(zones, 'PT-CONT'), undefined)
  }
  assert.equal(findSimulationZone([{ zone_code: 'PT-CONT' }], ''), undefined)
})
