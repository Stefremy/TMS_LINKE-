const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {importClientServices,importableClientServiceIds}=load('lib/clients/import-service-pricing.ts')
const {calculateShipmentPrice}=load('lib/pricing/calculate-shipment-price.ts')
const catalog=['a','b','c'].map(id=>({id,name:id,is_active:id!=='c',fuel_surcharge_pct:10,zones:[{zone_code:'PT-CONT',zone_name:'Continente',tiers:[{id:`${id}-1`,label:'Até 5 kg',weight_max:5,sell_price:5,cost_price:2,enabled:true}]}]}))
const row={id:'new-tier',label:'Até 2 kg',weight_max:2,sell_price:3.5}
const source=()=>({id:'source',code:'CL1',short_name:'Origem',assigned_linke_service_ids:['a','b','c','missing','b'],default_linke_table_id:'b',
 custom_tier_overrides:{a:[4],'a::ES-PENIN':[8],b:[6],c:[999],unrelated:[123]},
 pricing:{fuel_surcharge_pct:99,discount_pct:50,special_services_fees:[{id:'private-fee'}],service_weight_tiers:{'b::PT-CONT':[row],'unrelated::PT-CONT':[row]}}})
const target=()=>({id:'target',short_name:'Destino',email:'target@example.invalid',iban:'target-bank',credit_limit:321,assigned_linke_service_ids:['a'],default_linke_table_id:'a',
 custom_tier_overrides:{a:[7],'a::ES-PENIN':[9],unrelated:[11]},
 pricing:{fuel_surcharge_pct:8,special_services_fees:[{id:'target-fee'}],service_weight_tiers:{'a::PT-CONT':[{...row,id:'kept',sell_price:7}],'unrelated::PT-CONT':[row]}}})

test('import merges only active authorized services and preserves existing customer prices and general fields',()=>{
 const before=target(),from=source()
 const result=importClientServices(before,from,catalog)
 assert.equal(result.added,1);assert.equal(result.updated,0)
 assert.deepEqual(result.client.assigned_linke_service_ids,['a','b'])
 assert.equal(result.client.default_linke_table_id,'a')
 assert.deepEqual(result.client.custom_tier_overrides,{a:[7],'a::ES-PENIN':[9],unrelated:[11],b:[6]})
 assert.deepEqual(result.client.pricing.service_weight_tiers['a::PT-CONT'],before.pricing.service_weight_tiers['a::PT-CONT'])
 assert.deepEqual(result.client.pricing.service_weight_tiers['b::PT-CONT'],[row])
 assert.equal(result.client.pricing.fuel_surcharge_pct,8)
 assert.deepEqual(result.client.pricing.special_services_fees,[{id:'target-fee'}])
 for(const field of ['id','short_name','email','iban','credit_limit']) assert.equal(result.client[field],before[field])
 assert.equal(before.assigned_linke_service_ids.length,1)
 assert.equal(from.assigned_linke_service_ids.length,5)
})

test('explicitly replacing existing prices clears stale zone overrides, supports standard-price sources, and preserves other services',()=>{
 const from=source();from.pricing.service_weight_tiers={}
 const result=importClientServices(target(),from,catalog,true)
 assert.equal(result.added,1);assert.equal(result.updated,1)
 assert.deepEqual(result.client.custom_tier_overrides.a,[4])
 assert.equal(result.client.pricing.service_weight_tiers['a::PT-CONT'],undefined)
 assert.deepEqual(result.client.pricing.service_weight_tiers['unrelated::PT-CONT'],[row])
 from.custom_tier_overrides={}
 const standard=importClientServices(target(),from,catalog,true).client
 assert.equal(standard.custom_tier_overrides.a,undefined)
 assert.equal(standard.custom_tier_overrides['a::ES-PENIN'],undefined)
 assert.deepEqual(standard.custom_tier_overrides.unrelated,[11])
})

test('new customers inherit a valid source default and imported prices calculate independently of source changes',()=>{
 const from=source()
 const draft=importClientServices({id:'new',assigned_linke_service_ids:[],pricing:{fuel_surcharge_pct:0}},from,catalog).client
 assert.equal(draft.default_linke_table_id,'b')
 assert.equal(calculateShipmentPrice(1,draft,catalog,'PT','4800-001',{requireConfiguredTariff:true}).basePrice,3.5)
 draft.pricing.service_weight_tiers['b::PT-CONT'][0].sell_price=4.5
 draft.custom_tier_overrides.a[0]=20
 assert.equal(from.pricing.service_weight_tiers['b::PT-CONT'][0].sell_price,3.5)
 assert.equal(from.custom_tier_overrides.a[0],4)
 assert.equal(calculateShipmentPrice(1,{...from,default_linke_table_id:'b'},catalog,'PT','4800-001',{requireConfiguredTariff:true}).basePrice,3.5)
})

test('empty, self and legacy imports handle authorizations consistently without reviving unavailable services',()=>{
 assert.deepEqual(importableClientServiceIds({...source(),assigned_linke_service_ids:undefined},catalog),['a','b'])
 assert.throws(()=>importClientServices(target(),{...source(),assigned_linke_service_ids:[]},catalog),/não tem serviços/)
 assert.throws(()=>importClientServices(target(),{...source(),id:'target'},catalog),/outro cliente/)
 const result=importClientServices({id:'new',assigned_linke_service_ids:[]},{...source(),default_linke_table_id:'c'},catalog)
 assert.equal(result.client.default_linke_table_id,'a')
 const repeated=importClientServices(result.client,source(),catalog)
 assert.equal(repeated.added,0);assert.equal(repeated.updated,0)
 assert.deepEqual(repeated.client,result.client)
})


test('a source customer cannot lend its exclusive service to another customer',()=>{
 const privateCatalog=[...catalog,{...catalog[0],id:'private',client_id:'source'}]
 const from={...source(),assigned_linke_service_ids:['a','private']}
 assert.deepEqual(importableClientServiceIds(from,privateCatalog,'target'),['a'])
 assert.deepEqual(importClientServices({id:'target',assigned_linke_service_ids:[]},from,privateCatalog).client.assigned_linke_service_ids,['a'])
})
