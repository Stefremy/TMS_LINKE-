const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const servicePath = 'lib/services/geo/international-postal-code.ts'
const { internationalPostalQuery } = createLoader({})(servicePath)

test('country-specific queries preserve leading zeros and normalize partial provider coverage', () => {
  for (const [country, input, expected] of [
    ['BE', '1000', '1000'], ['FR', '75001', '75001'], ['DE', '01067', '01067'],
    ['FI', '00100', '00100'], ['GB', 'SW1A 1AA', 'SW1A'], ['GB', 'SW1A1AA', 'SW1A'],
    ['NL', '1012 JS', '1012'], ['CA', 'H2Y 1C6', 'H2Y'], ['US', '90210-1234', '90210'],
    ['CZ', '11000', '110 00'], ['SK', '811 01', '811 01'], ['SE', '111 20', '11120'],
    ['LU', '1009', 'L-1009'],
  ]) assert.equal(internationalPostalQuery(input, country), expected, `${country}: ${input}`)
  for (const [country, input] of [['BE','100'],['FR','7500'],['DE','ABCDE'],['GB','INVALID'],['XX','1000'],['US','../secret']]) {
    assert.equal(internationalPostalQuery(input, country), null)
  }
})

test('international city lookup uses selected country and returns no invented street', async () => {
  const calls = []
  const { lookupInternationalPostalCode } = createLoader({ fetch: async (url, options) => {
    calls.push({url, options})
    return { ok: true, json: async () => ({ 'country abbreviation': 'BE', places: [{'place name':'Bruxelles'}] }) }
  } })(servicePath)
  const result = await lookupInternationalPostalCode('1000', 'be')
  assert.equal(result.city, 'Bruxelles')
  assert.equal(result.country, 'BE')
  assert.equal(result.street, undefined)
  assert.equal(calls[0].url, 'https://api.zippopotam.us/BE/1000')
  assert.equal(calls[0].options.next.revalidate, 86400)
  assert.ok(calls[0].options.signal instanceof AbortSignal)
})

test('multiple localities require a choice rather than choosing the first', async () => {
  const { lookupInternationalPostalCode } = createLoader({ fetch: async () => ({
    ok: true, json: async () => ({'country abbreviation':'FR', places:[{'place name':'Town A'},{'place name':'Town B'},{'place name':'Town A'}]}),
  }) })(servicePath)
  const result = await lookupInternationalPostalCode('75001', 'FR')
  assert.equal(result.city, '')
  assert.deepEqual(result.cities, ['Town A','Town B'])
})

test('partial provider codes never replace the full shipping postcode', async () => {
  let requested
  const { lookupInternationalPostalCode } = createLoader({ fetch: async url => {
    requested = url
    return {ok:true,json:async()=>({'country abbreviation':'GB',places:[{'place name':'London'}]})}
  } })(servicePath)
  assert.equal((await lookupInternationalPostalCode('SW1A 1AA','GB')).postalCode, 'SW1A 1AA')
  assert.equal(requested, 'https://api.zippopotam.us/GB/SW1A')
})

test('unavailable, absent, malformed or wrong-country results permit manual entry', async () => {
  for (const fetch of [
    async()=>{throw new Error('timeout')}, async()=>({ok:false}),
    async()=>({ok:true,json:async()=>null}),
    async()=>({ok:true,json:async()=>({'country abbreviation':'BE',places:[]})}),
    async()=>({ok:true,json:async()=>({'country abbreviation':'ES',places:[{'place name':'Madrid'}]})}),
  ]) {
    const { lookupInternationalPostalCode } = createLoader({fetch})(servicePath)
    assert.equal(await lookupInternationalPostalCode('1000','BE'), null)
  }
})

test('unsupported countries and incomplete postcodes do not call the provider', async () => {
  let calls = 0
  const { lookupInternationalPostalCode } = createLoader({fetch:async()=>{calls++;throw new Error('unexpected')}})(servicePath)
  assert.equal(await lookupInternationalPostalCode('1000','XX'),null)
  assert.equal(await lookupInternationalPostalCode('7500','FR'),null)
  assert.equal(calls,0)
})

test('local lookup cannot silently interpret Belgian/French codes as Spanish', () => {
  const { lookupPostalCode } = createLoader({'node:path':require('node:path'),'node:fs':require('node:fs')})('lib/services/geo/postal-code.service.ts')
  assert.equal(lookupPostalCode('75001','FR'),null)
  assert.equal(lookupPostalCode('1000','BE'),null)
})

test('local Portuguese lookup offers all streets and cities without choosing an ambiguous address', () => {
  const { lookupPostalCode } = createLoader({
    'node:path':require('node:path'), 'node:fs':{existsSync:()=>true},
    'node:sqlite':{ DatabaseSync: class { prepare() {return {all:()=>[
      {cp:'1234-567',rua:'Rua A',localidade:'Localidade A',concelho:'X',distrito:'Y'},
      {cp:'1234-567',rua:'Rua B',localidade:'Localidade B',concelho:'X',distrito:'Y'},
    ]}} } },
  })('lib/services/geo/postal-code.service.ts')
  const result = lookupPostalCode('1234-567','PT')
  assert.equal(result.street,undefined)
  assert.equal(result.city,'')
  assert.deepEqual(result.streets,['Rua A','Rua B'])
  assert.deepEqual(result.cities,['Localidade A','Localidade B'])
})
