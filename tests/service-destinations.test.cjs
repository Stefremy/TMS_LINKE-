const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {getServiceDestinationCountries,getServiceDestinationZone}=load('lib/services/service-destinations.ts')
const {buildOfficialCeTruckZones,buildOfficialLinkeInternationalZones,resolveInternationalZone}=load('lib/services/geo/international-zones.ts')
const tier={weight_max:30,sell_price:5,enabled:true}
const service=(zones,allowed_zones)=>({id:'table',is_active:true,zones:zones.map(zone_code=>({zone_code,tiers:[{...tier}]})),allowed_zones})
const codes=s=>getServiceDestinationCountries(s).map(c=>c.code)

test('national and Iberian tables expose only countries with configured and permitted zones',()=>{
  assert.deepEqual(codes(service(['PT-CONT'])),['PT'])
  assert.deepEqual(codes(service(['PT-CONT','ES-PENIN'])),['PT','ES'])
  assert.deepEqual(codes(service(['PT-CONT','ES-PENIN'],['PT-CONT'])),['PT'])
  assert.deepEqual(codes(service(['PT-CONT'],['PT-CONT','ES-PENIN'])),['PT'])
})
test('island-only tariffs still expose their country and postal codes refine the zone',()=>{
  assert.deepEqual(codes(service(['PT-ILHAS'])),['PT'])
  assert.deepEqual(codes(service(['ES-ILHAS'])),['ES'])
  const s=service(['ES-ILHAS'])
  assert.equal(getServiceDestinationZone(s,'ES','07001'),'ES-ILHAS')
  assert.equal(getServiceDestinationZone(s,'ES','28013'),'ES-PENIN')
})
test('international destinations include every mapped region, with Portuguese names and no duplicate aliases',()=>{
  const s={...service([]),zones:buildOfficialLinkeInternationalZones(20)}
  const before=JSON.stringify(s),countries=getServiceDestinationCountries(s),list=countries.map(c=>c.code)
  for(const code of ['DE','FR','BE','NL','SE','FI'])assert.ok(list.includes(code),code)
  for(const code of ['NO','GB','UK','CH','IS','US','CA','BR','JP','SA','AU','AO','CV'])assert.equal(list.includes(code),false,code)
  assert.equal(list.includes('PT'),false);assert.equal(list.includes('ES'),false)
  assert.equal(list.length,new Set(list).size)
  assert.equal(countries.find(c=>c.code==='DE').name,'Alemanha')
  assert.equal(JSON.stringify(s),before)
})
test('CE road tariffs follow their contract countries rather than the air-zone country groups',()=>{
  const s={...service([]),webservice_service_code:'ENCF008.02',zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3']}
  const list=codes(s)
  for(const code of ['DE','FR','PL','SE','MT'])assert.ok(list.includes(code),code)
  for(const code of ['PT','ES','US','RO','BG','UK','GB','NO','IS','CH'])assert.equal(list.includes(code),false,code)
  assert.equal(getServiceDestinationZone(s,'PL'),'Zona 3')
  assert.equal(getServiceDestinationZone(s,'AT'),'Zona 2')
  const redactedCustomCe={id:'srv_linke_custom_ce',code:'LK-901',is_active:true,zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3']}
  assert.deepEqual(codes(redactedCustomCe),list)
  assert.equal(getServiceDestinationZone(redactedCustomCe,'DE'),'Zona 2')
  assert.equal(getServiceDestinationZone(redactedCustomCe,'PL'),'Zona 3')
  s.zones=s.zones.filter(z=>z.zone_code==='Zona 2')
  assert.equal(codes(s).includes('PL'),false)
})
test('disabled, missing and empty tiers never offer arbitrary countries',()=>{
  for(const s of [undefined,{...service(['PT-CONT']),is_active:false},service([]),{zones:[{zone_code:'EU 1',tiers:[]}]},
    {zones:[{zone_code:'EU 1',tiers:[{...tier,enabled:false}]}]}])assert.deepEqual(codes(s),[])
  assert.deepEqual(codes(service(['PT-CONT'],['INTL'])),[])
})
test('zone aliases, broad coverage and published tables without internal costs retain their countries',()=>{
  const s=service(['EU-Z1'],['INTL-AERO'])
  assert.ok(codes(s).includes('FR'));assert.equal(codes(s).includes('US'),false)
  assert.deepEqual(codes(service(['PT-CONT'])),['PT'])
  assert.equal(resolveInternationalZone('SA'),'O2')
  assert.equal(resolveInternationalZone('BA'),'SA')
})

test('multi-country primordial contracted services expose and map PT, ES and islands accurately',()=>{
  const {buildContractZoneMatrix,buildSubproductContractZones,detectCarrierGroup,normalizeServiceZoneCode}=load('lib/pricing/carrier-zone-templates.ts')
  const {resolveZoneTierOverrides,getServiceZoneOverrideKey,calculateShipmentPrice}=load('lib/pricing/calculate-shipment-price.ts')

  // CTT Guia DD & DB (PT-CONT + PT-ILHAS + ES-PENIN)
  const ddContract = buildSubproductContractZones('ctt', 'EMSF056.01')
  assert.deepEqual(ddContract.allowedZones, ['PT-CONT', 'PT-ILHAS', 'ES-PENIN'])
  assert.deepEqual(codes({ ...service([]), zones: ddContract.zones, allowed_zones: ddContract.allowedZones }), ['PT', 'ES'])

  const dbContract = buildSubproductContractZones('ctt', 'EMSF057.01')
  assert.deepEqual(dbContract.allowedZones, ['PT-CONT', 'PT-ILHAS', 'ES-PENIN'])
  assert.deepEqual(codes({ ...service([]), zones: dbContract.zones, allowed_zones: dbContract.allowedZones }), ['PT', 'ES'])

  // Correos Paq 24 & Paq 48 (PT-CONT + ES-PENIN)
  const cor24 = buildSubproductContractZones('correos', '61')
  assert.deepEqual(cor24.allowedZones, ['PT-CONT', 'ES-PENIN'])
  assert.deepEqual(codes({ ...service([]), zones: cor24.zones, allowed_zones: cor24.allowedZones }), ['PT', 'ES'])

  const cor48 = buildSubproductContractZones('correos', '62')
  assert.deepEqual(cor48.allowedZones, ['PT-CONT', 'ES-PENIN'])
  assert.deepEqual(codes({ ...service([]), zones: cor48.zones, allowed_zones: cor48.allowedZones }), ['PT', 'ES'])

  // Correos Islas (ES-ILHAS)
  const corIslas = buildSubproductContractZones('correos', '66')
  assert.deepEqual(corIslas.allowedZones, ['ES-ILHAS'])
  assert.deepEqual(codes({ ...service([]), zones: corIslas.zones, allowed_zones: corIslas.allowedZones }), ['ES'])

  // Legacy PT-ACORES normalization
  const legacyDd = {
    id: 'srv_linke_dd_std',
    is_active: true,
    allowed_zones: ['PT-CONT', 'PT-ILHAS', 'ES-PENIN'],
    zones: [
      { zone_code: 'PT-CONT', tiers: [{ weight_max: 5, sell_price: 3.70, cost_price: 2.96, enabled: true }] },
      { zone_code: 'PT-ACORES', tiers: [{ weight_max: 5, sell_price: 12.91, cost_price: 10.33, enabled: true }] },
      { zone_code: 'ES-PENIN', tiers: [{ weight_max: 5, sell_price: 4.07, cost_price: 3.26, enabled: true }] },
    ],
  }
  assert.equal(getServiceDestinationZone(legacyDd, 'PT', '9500-001'), 'PT-ILHAS')
  assert.equal(getServiceDestinationZone(legacyDd, 'ES', '28013'), 'ES-PENIN')
  assert.equal(getServiceDestinationZone(legacyDd, 'PT', '1000-001'), 'PT-CONT')

  // Per-zone client overrides (${serviceId}::${zoneCode})
  const clientOverrides = {
    [getServiceZoneOverrideKey('srv_linke_dd_std', 'PT-CONT')]: [3.50],
    [getServiceZoneOverrideKey('srv_linke_dd_std', 'PT-ILHAS')]: [11.00],
    [getServiceZoneOverrideKey('srv_linke_dd_std', 'ES-PENIN')]: [3.90],
  }
  assert.deepEqual(resolveZoneTierOverrides(clientOverrides, legacyDd, 'PT-CONT'), [3.50])
  assert.deepEqual(resolveZoneTierOverrides(clientOverrides, legacyDd, 'PT-ILHAS'), [11.00])
  assert.deepEqual(resolveZoneTierOverrides(clientOverrides, legacyDd, 'ES-PENIN'), [3.90])

  // Pricing calculations per zone
  const client = { default_linke_table_id: legacyDd.id, custom_tier_overrides: clientOverrides }
  const ptQuote = calculateShipmentPrice(1, client, [legacyDd], 'PT', '1000-001', { requireConfiguredTariff: true })
  const ilhasQuote = calculateShipmentPrice(1, client, [legacyDd], 'PT', '9500-001', { requireConfiguredTariff: true })
  const esQuote = calculateShipmentPrice(1, client, [legacyDd], 'ES', '28013', { requireConfiguredTariff: true })

  assert.equal(ptQuote.basePrice, 3.50)
  assert.equal(ilhasQuote.basePrice, 11.00)
  assert.equal(esQuote.basePrice, 3.90)

  // Future custom tables detection when carrier fields are redacted
  const customCtt = { id: 'srv_cust_1', code: 'LK-CTT-899', is_active: true, zones: ddContract.zones, carrier_group: 'ctt' }
  const customCor = { id: 'srv_cust_2', code: 'LK-COR-512', is_active: true, zones: cor24.zones, carrier_group: 'correos' }
  assert.equal(detectCarrierGroup(customCtt), 'ctt')
  assert.equal(detectCarrierGroup(customCor), 'correos')
})


test('client price overrides are isolated per table: a variant and its original never share adjusted prices', () => {
  const {resolveZoneTierOverrides,getServiceZoneOverrideKey}=load('lib/pricing/calculate-shipment-price.ts')
  const zones = [{ zone_code: 'PT-CONT', tiers: [{ weight_max: 5, sell_price: 4, cost_price: 3, enabled: true }] }]
  const original = { id: 'srv_orig', zones }
  const variant = { id: 'srv_variant', zones: JSON.parse(JSON.stringify(zones)) }
  const overrides = {
    [getServiceZoneOverrideKey('srv_variant', 'PT-CONT')]: [2.5],
    [getServiceZoneOverrideKey('srv_orig', 'PT-ILHAS')]: [9],
  }
  assert.deepEqual(resolveZoneTierOverrides(overrides, variant, 'PT-CONT'), [2.5])
  assert.equal(resolveZoneTierOverrides(overrides, original, 'PT-CONT'), undefined)
  assert.equal(resolveZoneTierOverrides(overrides, variant, 'PT-ILHAS'), undefined)
  assert.equal(original.zones[0].tiers[0].sell_price, 4)
})
