const test=require('node:test'), assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const crypto=require('node:crypto')
const loadPure=createLoader({})
const pure=loadPure('lib/billing/carrier-weight-pricing.ts')
const {calculateShipmentPrice}=loadPure('lib/pricing/calculate-shipment-price.ts')
const {buildOfficialCeTruckZones}=loadPure('lib/services/geo/international-zones.ts')
const T='11111111-1111-1111-1111-111111111111', C='22222222-2222-2222-2222-222222222222', S='33333333-3333-4333-8333-333333333333'
const tier=(max,price,cost)=>({id:String(max),label:`Até ${max} kg`,weight_max:max,sell_price:price,cost_price:cost,margin_pct:20,enabled:true})
const service={id:'svc',name:'CTT Teste',is_active:true,fuel_surcharge_pct:10,zones:[{zone_code:'PT-CONT',zone_name:'Continente',tiers:[tier(2,4,2),tier(5,6,4),tier(10,9,6),tier(20,12,9)]},{zone_code:'ES-PENIN',zone_name:'Espanha',tiers:[tier(10,15,9)]}]}
const basis=()=>pure.captureWeightPricingBasis({},service,'PT','4800-001')
const input=()=>({basis:basis(),previousWeightKg:1,weightKg:6,sellPrice:5.9,buyPrice:2,basePrice:4,fuelAmount:0.4,specialAmount:1.5})
test('1 kg → 6 kg selects the matching tier, recalculates fuel and preserves recorded extras',()=>{
 const p=pure.planWeightAdjustment(input());assert.equal(p.tier,'Até 10 kg');assert.equal(p.basePrice,9);assert.equal(p.fuelAmount,0.9);assert.equal(p.price,11.4);assert.equal(p.difference,5.5);assert.equal(p.buyPrice,6)
})
test('same tier, unchanged/lower readings never cause another charge or automatic refund',()=>{
 for(const weightKg of [0.5,1,1.5,2]) assert.equal(pure.planWeightAdjustment({...input(),weightKg}),null)
 assert.equal(pure.planWeightAdjustment({...input(),previousWeightKg:6,weightKg:7,sellPrice:11.4,buyPrice:6,basePrice:9,fuelAmount:0.9}),null)
})
test('future table edits do not affect the captured tariff and unsupported weights fail closed',()=>{
 const i=input();service.zones[0].tiers[2].sell_price=99
 try{assert.equal(pure.planWeightAdjustment(i).price,11.4)}finally{service.zones[0].tiers[2].sell_price=9}
 assert.throws(()=>pure.planWeightAdjustment({...input(),weightKg:30}),/Tarifa não configurada/)
})
test('client overrides and zone-specific prices are frozen without credentials or unrelated zones',()=>{
 const b=pure.captureWeightPricingBasis({email:'private',custom_tier_overrides:{svc:[5,7,10,13]}},{...service,webservice_connection_id:'secret'},'PT','4800-001')
 assert.equal(b.service.zones.length,1);assert.equal(b.service.webservice_connection_id,undefined);assert.equal(b.client.email,undefined)
 const p=pure.planWeightAdjustment({...input(),basis:b,basePrice:5,fuelAmount:0.5,sellPrice:7});assert.equal(p.price,12.5)
 const es=pure.captureWeightPricingBasis({custom_tier_overrides:{svc:[5]}},service,'ES','28001');assert.equal(es.client.custom_tier_overrides,undefined)
})
test('CE shipments capture the same road tariff as their quote and retain it for weight adjustments',()=>{
 const ce={id:'negotiated-ce',name:'CE Cliente',code:'CE-CLIENTE',webservice_service_code:'ENCF008.02',
  webservice_connection_id:'private-connection',is_active:true,zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3'],fuel_surcharge_pct:12.5}
 for(const [country,zone] of [['FI','Zona 3'],['PL','Zona 3'],['FR','Zona 2'],['AT','Zona 2']]){
  const client={default_linke_table_id:ce.id}
  const quote=calculateShipmentPrice(1,client,[ce],country,'00100',{requireConfiguredTariff:true})
  const captured=pure.captureWeightPricingBasis(client,ce,country,'00100')
  assert.equal(captured.service.zones.length,1);assert.equal(captured.service.zones[0].zone_code,zone)
  assert.equal(captured.service.webservice_service_code,'ENCF008.02')
  assert.equal(captured.service.webservice_connection_id,undefined)
  assert.deepEqual(calculateShipmentPrice(1,captured.client,[captured.service],country,'00100',{requireConfiguredTariff:true}),quote)
  const increased=calculateShipmentPrice(6,client,[ce],country,'00100',{requireConfiguredTariff:true})
  const adjustment=pure.planWeightAdjustment({basis:captured,previousWeightKg:1,weightKg:6,
   sellPrice:quote.sellPrice,buyPrice:quote.buyPrice,basePrice:quote.basePrice,fuelAmount:quote.fuelSurchargeAmount,specialAmount:0})
  assert.equal(adjustment.price,increased.sellPrice)
 }
 // Legacy service identities must also survive in a private client's captured table.
 const legacy={...ce,webservice_service_code:undefined,code:'LK-CE-STD'}
 const captured=pure.captureWeightPricingBasis({},legacy,'FI','00100')
 assert.equal(calculateShipmentPrice(1,captured.client,[captured.service],'FI','00100',{requireConfiguredTariff:true}).isFallback,false)
})
test('European zone aliases also capture the quoted tariff rather than failing after pricing',()=>{
 const air={...service,zones:[{zone_code:'EU-Z3',tiers:[tier(10,20,10)]}],allowed_zones:['EU 3']}
 const quote=calculateShipmentPrice(1,{default_linke_table_id:air.id},[air],'FI','00100',{requireConfiguredTariff:true})
 const captured=pure.captureWeightPricingBasis({},air,'FI','00100')
 assert.equal(captured.service.zones[0].zone_code,'EU-Z3')
 assert.equal(calculateShipmentPrice(1,captured.client,[captured.service],'FI','00100',{requireConfiguredTariff:true}).sellPrice,quote.sellPrice)
})
test('CE countries outside the road contract cannot inherit an air-zone tariff',()=>{
 const ce={...service,webservice_service_code:'ENCF008.02',zones:buildOfficialCeTruckZones()}
 assert.throws(()=>calculateShipmentPrice(1,{default_linke_table_id:ce.id},[ce],'RO','010101',{requireConfiguredTariff:true}),/Tarifa não configurada|Serviço indisponível/)
})
test('unknown CTT units never become kilograms; explicit g/kg conversion is required',()=>{
 assert.equal(pure.weightInKg({value:6000,unit:null}),null)
 assert.equal(pure.weightInKg({value:6000,unit:null},'g'),6)
 assert.equal(pure.weightInKg({value:6,unit:'kg'}),6)
 for(const unit of ['', 'grams','cm'])assert.equal(pure.weightInKg({value:6,unit:null},unit),null)
 for(const value of [0,-1,Infinity,NaN])assert.equal(pure.weightInKg({value,unit:'kg'}),null)
})
test('modified prices, missing evidence and malformed money cannot silently switch a tariff',()=>{
 for(const change of [{sellPrice:1},{buyPrice:99},{basePrice:0},{fuelAmount:2},{specialAmount:-1},{previousWeightKg:0},{basis:null},{sellPrice:null},{sellPrice:5.901}])assert.throws(()=>pure.planWeightAdjustment({...input(),...change}))
})
function worker({enabled=true,unit='g',carrier='ctt',mutate,error,rpcResult={status:'adjusted'}}={}){
 const oldEnabled=process.env.CARRIER_WEIGHT_REPRICING_ENABLED,oldUnit=process.env.CTT_MEASURED_WEIGHT_UNIT
 process.env.CARRIER_WEIGHT_REPRICING_ENABLED=enabled?'true':'false';if(unit===undefined)delete process.env.CTT_MEASURED_WEIGHT_UNIT;else process.env.CTT_MEASURED_WEIGHT_UNIT=unit
 const tables={shipments:[{id:S,tenant_id:T,client_id:C,sell_price:5.9,buy_price:2,status:'entregue',carrier_code:carrier}],audit_log:[
  {id:'snapshot',tenant_id:T,action:'shipment_data',created_at:'2026-10-22',details:{id:S,client_id:C,weight_kg:1,base_price:4,fuel_tax_amount:0.4,special_fees_amount:1.5,weight_pricing_basis:basis()}},
  {id:'measurement',tenant_id:T,action:'shipment_carrier_measurements',created_at:'2026-10-23',details:{shipment_id:S,carrier,measurements:{source:carrier==='ctt'?'ctt_events_v3':'correos_tracking',weight:{value:carrier==='ctt'?6000:6,unit:carrier==='ctt'?null:'kg'}},retrieved_at:'2026-10-23'}}]}
 mutate?.(tables);const db=fakeSupabase(tables);const calls=[]
 db.client.rpc=async(name,args)=>{calls.push({name,args});return{data:rpcResult,error:error?{message:error}:null}}
 const load=createLoader({'node:crypto':crypto})
 return{db,calls,async run(tenant=T){try{return await load('lib/billing/reconcile-carrier-weight.ts').reconcileCarrierWeight(db.client,tenant,S)}finally{if(oldEnabled===undefined)delete process.env.CARRIER_WEIGHT_REPRICING_ENABLED;else process.env.CARRIER_WEIGHT_REPRICING_ENABLED=oldEnabled;if(oldUnit===undefined)delete process.env.CTT_MEASURED_WEIGHT_UNIT;else process.env.CTT_MEASURED_WEIGHT_UNIT=oldUnit}}}
}
test('automatic worker binds tenant, client, snapshot and measurement; caller never supplies a price',async()=>{
 const h=worker();const r=await h.run();assert.equal(r.status,'adjusted');assert.equal(h.calls.length,1)
 assert.deepEqual([h.calls[0].args.p_tenant,h.calls[0].args.p_client,h.calls[0].args.p_shipment,h.calls[0].args.p_snapshot,h.calls[0].args.p_measurement],[T,C,S,'snapshot','measurement'])
 assert.equal(h.calls[0].args.p_plan.difference,5.5);assert.equal(h.db.writes.length,0)
})
test('Correos kg can use the same automatic tariff adjustment',async()=>{const h=worker({carrier:'correos'});assert.equal((await h.run()).price,11.4)})
test('disabled, unknown units, legacy rows and foreign ownership never call the financial RPC',async()=>{
 for(const options of [{enabled:false},{unit:''},{mutate:t=>delete t.audit_log[0].details.weight_pricing_basis},{mutate:t=>t.audit_log[0].details.package_count=2},{mutate:t=>t.audit_log[0].details.client_id='other'},{mutate:t=>t.shipments[0].billing_statement_id='billed'},{mutate:t=>t.audit_log[1].details.carrier='correos'}]){
  const h=worker(options);await h.run();assert.equal(h.calls.length,0)
 }
 const h=worker();await h.run('other-tenant');assert.equal(h.calls.length,0)
})
test('missing migration or a stale invoice claim preserves the price and reports the block',async()=>{
 const h=worker({error:'function missing'});assert.equal((await h.run()).status,'unavailable');assert.equal(h.db.writes.length,0)
 const locked=worker({rpcResult:{status:'locked'}});assert.equal((await locked.run()).status,'locked')
})
test('per-zone client overrides price Zona 2 and Zona 3 independently and survive weight adjustments',()=>{
 const {getServiceZoneOverrideKey}=loadPure('lib/pricing/calculate-shipment-price.ts')
 const {calculateClientShipmentPreview}=loadPure('lib/pricing/calculate-client-shipment-preview.ts')
 const ce={id:'srv_linke_ce_std',name:'Linke Europa Terrestre Económico (Guia CE)',code:'LK-CE-STD',webservice_service_code:'ENCF008.02',
  is_active:true,zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3'],fuel_surcharge_pct:10}
 const z2Overrides=ce.zones[0].tiers.map((t,i)=>i===0?14.00:i===5?25.00:t.sell_price)
 const z3Overrides=ce.zones[1].tiers.map((t,i)=>i===0?15.00:i===5?32.00:t.sell_price)
 const client={default_linke_table_id:ce.id,custom_tier_overrides:{
  [getServiceZoneOverrideKey(ce.id,'Zona 2')]:z2Overrides,
  [getServiceZoneOverrideKey(ce.id,'Zona 3')]:z3Overrides,
 }}
 const qFr=calculateShipmentPrice(1,client,[ce],'FR','75001',{requireConfiguredTariff:true})
 const qPl=calculateShipmentPrice(1,client,[ce],'PL','00-001',{requireConfiguredTariff:true})
 assert.equal(qFr.basePrice,14.00);assert.equal(qPl.basePrice,15.00)
 const redactedCe={...ce,webservice_service_code:undefined,code:'LK-901',zones:ce.zones.map(z=>({...z,tiers:z.tiers.map(t=>({...t,cost_price:undefined,margin_pct:undefined}))}))}
 const redactedClient={...client,default_linke_table_id:redactedCe.id,custom_tier_overrides:{
  [getServiceZoneOverrideKey(redactedCe.id,'Zona 2')]:z2Overrides,
  [getServiceZoneOverrideKey(redactedCe.id,'Zona 3')]:z3Overrides,
 }}
 assert.equal(calculateClientShipmentPreview(1,redactedClient,redactedCe,'FR','75001').basePrice,14.00)
 assert.equal(calculateClientShipmentPreview(1,redactedClient,redactedCe,'PL','00-001').basePrice,15.00)
 const basisPl=pure.captureWeightPricingBasis(client,ce,'PL','00-001')
 assert.equal(basisPl.service.zones.length,1);assert.equal(basisPl.service.zones[0].zone_code,'Zona 3')
 const adjPl=pure.planWeightAdjustment({basis:basisPl,previousWeightKg:1,weightKg:8,
  sellPrice:qPl.sellPrice,buyPrice:qPl.buyPrice,basePrice:qPl.basePrice,fuelAmount:qPl.fuelSurchargeAmount,specialAmount:0})
 assert.equal(adjPl.basePrice,32.00)
})
