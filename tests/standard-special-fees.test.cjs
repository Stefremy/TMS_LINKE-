const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const load=createLoader({})
const {DEFAULT_STANDARD_SPECIAL_FEES:defaults}=load('lib/pricing/special-fee-catalogue.ts')
const {resolveClientSpecialFees,inheritStandardSpecialFees,withStandardSpecialFees,validateStandardSpecialFees,validateClientSpecialFees}=load('lib/pricing/special-fees.ts')
const {calculateShipmentSpecialFees}=load('lib/pricing/calculate-shipment-quote.ts')
const {codDestination,COD_DESTINATIONS}=load('lib/pricing/cod-destination-rates.ts')
const tenant='11111111-1111-1111-1111-111111111111',clientId='22222222-2222-2222-2222-222222222222'
const code='fragil'
const amount=rows=>rows.find(f=>f.special_service_code===code).fixed_value
const standard=(value)=>defaults.map(f=>({...f,...(f.special_service_code===code?{fixed_value:value}:{})}))
function setup({role='admin',permissions=[],events=[],failure}={}){
 const ctx={tenant_id:tenant,role,client_id:role==='client'?clientId:undefined,permissions,user:{id:'staff-fixture'}}
 const tables={clients:[{id:clientId,tenant_id:tenant,name:'Fixture'}],audit_log:[{id:'client-profile',tenant_id:tenant,action:'client_data',created_at:'2026-01-01',details:{id:clientId,short_name:'Fixture',billing_type:'conta_corrente'}},...events],servicos_linke:[{id:'service',tenant_id:tenant,name:'CTT Expresso',carrier_group:'ctt',is_active:true,zones:[]}]}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const {hasPermission}=load('lib/auth/permissions.ts')
 const loader=createLoader({
  '@/lib/auth/context':{requireUser:async()=>ctx,requireEmployee:async requested=>{if(role!=='admin'&&role!=='employee')throw Error('STAFF_REQUIRED');if(requested&&!(typeof requested==='string'?[requested]:requested).some(p=>hasPermission(ctx,p)))throw Error('MODULE_DENIED');return ctx},getTenantId:async()=>tenant},
  '@/lib/supabase/server':{createAdminClient:()=>db.client},'next/cache':{revalidatePath(){}},
  'next/navigation':{redirect:()=>{throw Error('REDIRECT')}},
 })
 return {ctx,tables,db,load:loader,actions:loader('app/actions/special-fees.ts')}
}
const settings=(fees,date='2026-02-01',company=tenant)=>({id:`settings-${date}`,tenant_id:company,action:'standard_special_services_fees',created_at:date,details:{fees}})

test('one catalogue supplies all CTT and Correos standard services without duplicate codes',()=>{
 assert.equal(new Set(defaults.map(f=>f.special_service_code)).size,defaults.length)
 assert.ok(defaults.some(f=>f.special_service_code==='cod'));assert.ok(defaults.some(f=>f.special_service_code==='correos_cod'))
 assert.ok(defaults.some(f=>f.special_service_code==='correos_signed_guide_return'))
 assert.ok(inheritStandardSpecialFees().every(f=>f.use_standard===true))
})

test('inheritance updates standard rows while preserving negotiated zero, percentage, minimum and disabled flags',()=>{
 const configured=[{...defaults.find(f=>f.special_service_code==='fragil'),fixed_value:0,is_enabled:false},
  {...defaults.find(f=>f.special_service_code==='cod'),percentage_value:0,min_value:0,use_standard:false},
  {...defaults.find(f=>f.special_service_code==='saturday'),fixed_value:999,use_standard:true}]
 const resolved=resolveClientSpecialFees(configured,standard(8))
 assert.equal(amount(resolved),0);assert.equal(resolved.find(f=>f.special_service_code===code).is_enabled,false)
 assert.equal(resolved.find(f=>f.special_service_code==='cod').percentage_value,0)
 assert.equal(resolved.find(f=>f.special_service_code==='cod').min_value,0)
 assert.equal(resolved.find(f=>f.special_service_code==='saturday').fixed_value,8.5)
 assert.equal(amount(resolveClientSpecialFees(inheritStandardSpecialFees(),standard(8))),8)
 assert.equal(defaults.find(f=>f.special_service_code===code).fixed_value,1.5)
})

test('older negotiated rows and custom fees survive adding new standard services',()=>{
 const legacy=[{...defaults[0],percentage_value:1.8},{...defaults[1],special_service_code:'custom-service',fixed_value:0}]
 const resolved=resolveClientSpecialFees(legacy)
 assert.equal(resolved.length,defaults.length+1)
 assert.equal(resolved[0].percentage_value,1.8);assert.equal(resolved[0].use_standard,false)
 assert.equal(resolved.find(f=>f.special_service_code==='custom-service').fixed_value,0)
 assert.ok(resolved.find(f=>f.special_service_code==='fragil').use_standard)
 const saturday={...defaults.find(f=>f.special_service_code==='correos_saturday'),fixed_value:8.5}
 const negotiated=withStandardSpecialFees({pricing:{special_services_fees:[saturday]}},defaults)
 assert.equal(calculateShipmentSpecialFees(10,negotiated,'correos',['correos_saturday']).amount,8.5)
})

test('amount, type and enabled state follow the current standard only when the client opted in',()=>{
 const custom=standard(9).map(f=>({...f,use_standard:false}))
 const next=standard(4).map(f=>({...f,...(f.special_service_code===code?{fee_type:'percentage',percentage_value:10,min_value:2,is_enabled:false}:{})}))
 assert.equal(resolveClientSpecialFees(inheritStandardSpecialFees(),next).find(f=>f.special_service_code===code).is_enabled,false)
 assert.equal(amount(resolveClientSpecialFees(custom,next)),9)
 assert.equal(calculateShipmentSpecialFees(10,withStandardSpecialFees({pricing:{special_services_fees:custom}},next),'ctt',[code]).amount,9)
})

test('configuration-only services remain unavailable even if enabled in a client override or standard submission',()=>{
 const fees=defaults.map(f=>({...f,is_enabled:true}))
 const validated=validateStandardSpecialFees(fees)
 for(const code of ['correos_delivery_window','correos_signed_guide_return','correos_spain_supplement']){
  assert.equal(validated.find(f=>f.special_service_code===code).is_enabled,false)
  assert.equal(resolveClientSpecialFees(fees).find(f=>f.special_service_code===code).is_enabled,false)
 }
})

test('standard validation rejects missing rows, duplicate codes, negative and non-finite money without trusting metadata',()=>{
 assert.throws(()=>validateStandardSpecialFees(defaults.slice(1)))
 assert.throws(()=>validateStandardSpecialFees([...defaults.slice(1),defaults[1]]))
 for(const value of [-1,NaN,Infinity,null,'1'])assert.throws(()=>validateStandardSpecialFees(defaults.map(f=>({...f,fixed_value:value}))))
 const valid=validateStandardSpecialFees(defaults.map(f=>({...f,special_service_name:'forged',api_type_code:999})))
 assert.equal(valid[0].special_service_name,defaults[0].special_service_name)
 assert.equal(valid[0].api_type_code,defaults[0].api_type_code)
 assert.equal(validateStandardSpecialFees([defaults[0]],true).length,defaults.length)
 assert.throws(()=>validateClientSpecialFees([{...defaults[0],percentage_value:-1}]))
})

test('standard saves are company scoped and never rewrite clients or booked shipments',async()=>{
 const h=setup()
 assert.equal((await h.actions.saveStandardSpecialFeesAction(standard(6))).success,true)
 assert.equal(amount((await h.actions.getStandardSpecialFeesAction()).fees),6)
 assert.equal(h.db.writes.length,1);assert.equal(h.db.writes[0].table,'audit_log')
 assert.equal(h.db.writes[0].value.tenant_id,tenant)
 assert.equal(h.db.writes[0].value.details.updated_by_user_id,'staff-fixture')
 assert.ok(h.db.queries.every(q=>q.write||q.filters.some(f=>f.field==='tenant_id'&&f.value===tenant)))
})

test('client logins and staff without the management module cannot change standard prices',async()=>{
 for(const options of [{role:'client'},{role:'employee',permissions:[]}]){
  const h=setup(options)
  await assert.rejects(h.actions.saveStandardSpecialFeesAction(defaults),/REQUIRED|DENIED/)
  assert.deepEqual(h.db.writes,[])
 }
 for(const permission of ['Gestão de Clientes & Contratos','Faturação & Contas Correntes'])assert.equal((await setup({role:'employee',permissions:[permission]}).actions.saveStandardSpecialFeesAction(defaults)).success,true)
})

test('reads ignore another company and report failures instead of silently substituting prices',async()=>{
 const h=setup({events:[settings(standard(5)),settings(standard(99),'2099-01-01','foreign')]})
 assert.equal(amount((await h.actions.getStandardSpecialFeesAction()).fees),5)
 const failed=setup({failure:q=>q.table==='audit_log'?{message:'private DB detail'}:null})
 await assert.rejects(failed.actions.getStandardSpecialFeesAction(),/Não foi possível carregar/)
 const rejected=await setup({failure:q=>q.write?{message:'private DB detail'}:null}).actions.saveStandardSpecialFeesAction(defaults)
 assert.equal(rejected.success,false);assert.doesNotMatch(rejected.error,/private/)
})

test('authoritative shipment pricing uses standard rates and keeps an explicit client exception',async()=>{
 const h=setup({events:[settings(standard(7))]})
 const {loadShipmentPricingContext}=h.load('lib/pricing/shipment-pricing-context.ts')
 let result=await loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
 assert.equal(amount(result.client.pricing.special_services_fees),7)
 assert.equal(calculateShipmentSpecialFees(10,result.client,'ctt',[code]).amount,7)
 h.tables.audit_log[0].details.pricing={special_services_fees:[{...defaults.find(f=>f.special_service_code===code),fixed_value:2}]}
 result=await loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
 assert.equal(calculateShipmentSpecialFees(10,result.client,'ctt',[code]).amount,2)
})

test('cached client profiles still pick up a newer standard table on the next read',async()=>{
 const h=setup({events:[settings(standard(3))]})
 const clients=h.load('app/actions/clientes.ts')
 const first=await clients.getClientesAction(clientId)
 assert.equal(amount(first[0].pricing.special_services_fees),3)
 h.tables.audit_log.push(settings(standard(8),'2099-02-01'))
 const second=await clients.getClientesAction(clientId)
 assert.equal(amount(second[0].pricing.special_services_fees),8)
 assert.equal(h.db.writes.length,0)
})

test('saving unrelated customer details preserves negotiated fees and partial pricing fields',async()=>{
 const h=setup()
 const fees=[{...defaults.find(f=>f.special_service_code===code),fixed_value:0,use_standard:false}]
 h.tables.audit_log[0].details.pricing={fuel_surcharge_pct:4,special_services_fees:fees}
 const result=await h.load('app/actions/clientes.ts').saveClienteAction({id:clientId,short_name:'Updated'})
 assert.deepEqual(result.data.pricing.special_services_fees,fees)
 assert.equal(result.data.pricing.fuel_surcharge_pct,4)
})

test('editing one client fee creates only that exception; per-row reset restores inheritance',()=>{
 let slots=[],cursor=0,changed
 const jsx=(type,props)=>({type,props:props||{}})
 const editor=createLoader({react:{useState:initial=>{const i=cursor++;if(slots[i]===undefined)slots[i]=initial;return[slots[i],value=>slots[i]=value]}},'react/jsx-runtime':{jsx,jsxs:jsx}})('components/shipments/SpecialFeesEditor.tsx').SpecialFeesEditor
 const flat=node=>Array.isArray(node)?node.flatMap(flat):node&&typeof node==='object'?[node,...flat(node.props?.children)]:[]
 const render=fees=>{cursor=0;return flat(editor({fees,standards:standard(6),mode:'client',onChange:next=>changed=next}))}
 let nodes=render(inheritStandardSpecialFees(standard(6)))
 nodes.find(n=>n.type==='input'&&n.props['aria-label']===`Valor de ${defaults.find(f=>f.special_service_code===code).special_service_name}`).props.onChange({target:{value:'0'}})
 assert.equal(amount(changed),0);assert.equal(changed.find(f=>f.special_service_code===code).use_standard,false)
 assert.equal(changed.filter(f=>f.use_standard===false).length,1)
 nodes=render(changed)
 const resets=nodes.filter(n=>n.type==='button'&&n.props.children==='Voltar ao standard')
 assert.equal(resets.length,1);resets[0].props.onClick()
 assert.equal(amount(changed),6);assert.ok(changed.find(f=>f.special_service_code===code).use_standard)
})


test('client preview and server quote use identical effective standard and negotiated fees',async()=>{
 const h=setup({events:[settings(standard(7))]})
 Object.assign(h.tables.servicos_linke[0],{fuel_surcharge_pct:12.5,zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers:[{weight_max:5,cost_price:3,sell_price:8,enabled:true}]}]})
 const {loadShipmentPricingContext}=h.load('lib/pricing/shipment-pricing-context.ts')
 const {calculateShipmentQuote}=h.load('lib/pricing/calculate-shipment-quote.ts')
 const {calculateClientShipmentPreview}=h.load('lib/pricing/calculate-client-shipment-preview.ts')
 const loaded=await loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
 const client=(await h.load('app/actions/clientes.ts').getClientesAction(clientId))[0]
 const server=calculateShipmentQuote(1,loaded.client,loaded.service,'PT','4000-001',[code])
 const preview=calculateClientShipmentPreview(1,client,loaded.service,'PT','4000-001',[code])
 assert.equal(server.specialFeesAmount,7)
 assert.equal(preview.specialFeesAmount,server.specialFeesAmount)
 assert.equal(preview.totalPrice,server.totalPrice)
})

const fuelSetting=(percentage,date='2026-02-01',company=tenant)=>({id:`fuel-${date}`,tenant_id:company,action:'standard_fuel_surcharge',created_at:date,details:{percentage}})

test('fuel standard validates numbers including zero and saves only scoped configuration',async()=>{
 const h=setup()
 const actions=h.load('app/actions/fuel-surcharge.ts')
 assert.equal((await actions.getStandardFuelSurchargeAction()).fuelSurchargePct,undefined)
 for(const value of [-1,NaN,Infinity,null,'12',{}]){
  assert.equal((await actions.saveStandardFuelSurchargeAction(value)).success,false)
 }
 assert.equal(h.db.writes.length,0)
 assert.equal((await actions.saveStandardFuelSurchargeAction(0)).success,true)
 assert.equal((await actions.getStandardFuelSurchargeAction()).fuelSurchargePct,0)
 assert.equal(h.db.writes.length,1)
 assert.equal(h.db.writes[0].table,'audit_log')
 assert.equal(h.db.writes[0].value.tenant_id,tenant)
 assert.equal(h.db.writes[0].value.action,'standard_fuel_surcharge')
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===tenant)||q.write))
})

test('fuel configuration ignores other companies, fails closed and requires client or finance access',async()=>{
 const h=setup({events:[fuelSetting(14),fuelSetting(99,'2099-01-01','foreign')]})
 assert.equal((await h.load('app/actions/fuel-surcharge.ts').getStandardFuelSurchargeAction()).fuelSurchargePct,14)
 for(const options of [{role:'client'},{role:'employee',permissions:[]}]){
  const denied=setup(options)
  await assert.rejects(denied.load('app/actions/fuel-surcharge.ts').saveStandardFuelSurchargeAction(10),/REQUIRED|DENIED/)
  assert.equal(denied.db.writes.length,0)
 }
 for(const permission of ['Gestão de Clientes & Contratos','Faturação & Contas Correntes']){
  assert.equal((await setup({role:'employee',permissions:[permission]}).load('app/actions/fuel-surcharge.ts').saveStandardFuelSurchargeAction(10)).success,true)
 }
 const failed=setup({failure:q=>q.table==='audit_log'&&q.filters.some(f=>f.value==='standard_fuel_surcharge')?{message:'private error'}:null})
 await assert.rejects(failed.load('app/actions/fuel-surcharge.ts').getStandardFuelSurchargeAction(),/Não foi possível carregar/)
 const rejected=await setup({failure:q=>q.write?{message:'private error'}:null}).load('app/actions/fuel-surcharge.ts').saveStandardFuelSurchargeAction(10)
 assert.equal(rejected.success,false);assert.doesNotMatch(rejected.error,/private/)
})

test('saved fuel standard overrides client and carrier tables in server quotes, portal previews and frozen weight adjustments',async()=>{
 const h=setup({events:[fuelSetting(17)]})
 const service=h.tables.servicos_linke[0]
 Object.assign(service,{fuel_surcharge_pct:8.5,zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers:[
  {weight_max:5,cost_price:3,sell_price:10,enabled:true},
  {weight_max:10,cost_price:5,sell_price:20,enabled:true}]}]})
 h.tables.audit_log[0].details.pricing={fuel_surcharge_pct:4,standard_fuel_surcharge_pct:999}
 const {loadShipmentPricingContext}=h.load('lib/pricing/shipment-pricing-context.ts')
 const {calculateShipmentQuote}=h.load('lib/pricing/calculate-shipment-quote.ts')
 const {calculateClientShipmentPreview}=h.load('lib/pricing/calculate-client-shipment-preview.ts')
 const clients=h.load('app/actions/clientes.ts')
 const client=(await clients.getClientesAction(clientId))[0]
 const context=await loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
 assert.equal(context.client.pricing.standard_fuel_surcharge_pct,17)
 for(const carrier of ['ctt','correos']){
  const table={...context.service,carrier_group:carrier}
  const quote=calculateShipmentQuote(1,context.client,table,'PT','4000-001')
  const preview=calculateClientShipmentPreview(1,client,table,'PT','4000-001')
  assert.equal(quote.fuelSurchargeAmount,1.7)
  assert.equal(preview.fuelSurchargeAmount,1.7)
  assert.equal(preview.totalPrice,quote.totalPrice)
 }
 const {captureWeightPricingBasis,planWeightAdjustment}=h.load('lib/billing/carrier-weight-pricing.ts')
 const basis=captureWeightPricingBasis(context.client,context.service,'PT','4000-001')
 assert.equal(basis.service.fuel_surcharge_pct,17)
 h.tables.audit_log.push(fuelSetting(0,'2099-01-01'))
 const refreshed=(await clients.getClientesAction(clientId))[0]
 assert.equal(refreshed.pricing.standard_fuel_surcharge_pct,0)
 assert.equal(calculateShipmentQuote(1,refreshed,service,'PT','4000-001').fuelSurchargeAmount,0)
 assert.equal(basis.service.fuel_surcharge_pct,17)
 const adjusted=planWeightAdjustment({basis,previousWeightKg:1,weightKg:6,sellPrice:11.7,buyPrice:3,basePrice:10,fuelAmount:1.7,specialAmount:0})
 assert.equal(adjusted.fuelAmount,3.4);assert.equal(adjusted.fuelRatePct,17)
})

test('before the first fuel standard save, existing service rates remain and untrusted profile standards are ignored',async()=>{
 const h=setup()
 h.tables.audit_log[0].details.pricing={fuel_surcharge_pct:4,standard_fuel_surcharge_pct:999}
 const service=h.tables.servicos_linke[0]
 Object.assign(service,{fuel_surcharge_pct:8.5,zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers:[{weight_max:5,cost_price:3,sell_price:10,enabled:true}]}]})
 const context=await h.load('lib/pricing/shipment-pricing-context.ts').loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
 assert.equal(context.client.pricing.standard_fuel_surcharge_pct,undefined)
 const quote=h.load('lib/pricing/calculate-shipment-quote.ts').calculateShipmentQuote(1,context.client,context.service,'PT','4000-001')
 assert.equal(quote.fuelSurchargeAmount,0.85)
})

const codRates={
 'PT-CONT':{fee_type:'percentage',percentage_value:2,min_value:1.8},
 'PT-ILHAS':{fee_type:'percentage',percentage_value:3,min_value:4},
 'ES-PENIN':{fee_type:'fixed',fixed_value:5},
 'ES-BALEARES':{fee_type:'percentage',percentage_value:4,min_value:6},
}
const regionalStandards=()=>defaults.map(f=>['cod','correos_cod'].includes(f.special_service_code)?{...f,cod_destination_rates:structuredClone(codRates)}:{...f})

test('COD destination classification separates mainland Portugal, Madeira, Azores, mainland Spain and Baleares',()=>{
 for(const postal of ['4800-019','8000-001'])assert.equal(codDestination('PT',postal),'PT-CONT')
 for(const postal of ['9000-001','9500001'])assert.equal(codDestination('PT',postal),'PT-ILHAS')
 for(const postal of ['28013','08001'])assert.equal(codDestination(' es ',postal),'ES-PENIN')
 for(const postal of ['07001','07701','07800','07860'])assert.equal(codDestination('ES',postal),'ES-BALEARES')
 for(const postal of ['35001','38001','51001','52001','0700'])assert.equal(codDestination('ES',postal),undefined)
 assert.equal(codDestination('PT','9'),undefined)
 assert.equal(codDestination('FR','75001'),undefined)
})

test('both carriers charge COD by destination on the collection value, respecting each zone minimum and fixed price',()=>{
 const client=withStandardSpecialFees({},regionalStandards())
 for(const carrier of ['ctt','correos']){
  const code=carrier==='ctt'?'cod':'correos_cod'
  for(const [country,postal,amount] of [['PT','4800-019',2],['PT','9000-001',4],['PT','9500-001',4],['ES','28013',5]]){
   assert.equal(calculateShipmentSpecialFees(99,client,carrier,[code],100,{country,postal}).amount,amount)
  }
  assert.equal(calculateShipmentSpecialFees(10,client,carrier,[code],1000,{country:'PT',postal:'9500-001'}).amount,30)
  assert.equal(calculateShipmentSpecialFees(10,client,carrier,[code],1,{country:'PT',postal:'4800-019'}).amount,1.8)
  for(const postal of ['07001','07701','07800','07860']) {
   assert.equal(calculateShipmentSpecialFees(10,client,carrier,[code],100,{country:'ES',postal}).amount,6)
   assert.equal(calculateShipmentSpecialFees(10,client,carrier,[code],200,{country:'ES',postal}).amount,8)
  }
  const legacy=withStandardSpecialFees({},defaults)
  assert.equal(calculateShipmentSpecialFees(10,legacy,carrier,[code],100,{country:'ES',postal:'07001'}).amount,2,'unspecified Baleares rates retain the existing general commission')
 }
})

test('legacy negotiated COD remains unchanged in every new zone while inherited client zones track future standards',()=>{
 const standards=regionalStandards(),legacy={...defaults[0],percentage_value:1,min_value:.5}
 const old=resolveClientSpecialFees([legacy],standards).find(f=>f.special_service_code==='cod')
 for(const {code} of COD_DESTINATIONS){assert.equal(old.cod_destination_rates[code].percentage_value,1);assert.equal(old.cod_destination_rates[code].use_standard,false)}
 const custom=resolveClientSpecialFees(undefined,standards)
 const fee=custom.find(f=>f.special_service_code==='cod')
 fee.use_standard=false
 fee.cod_destination_rates['PT-ILHAS']={fee_type:'fixed',fixed_value:0,use_standard:false}
 standards.find(f=>f.special_service_code==='cod').cod_destination_rates['PT-CONT'].percentage_value=9
 const next=resolveClientSpecialFees(custom,standards).find(f=>f.special_service_code==='cod')
 assert.equal(next.cod_destination_rates['PT-ILHAS'].fixed_value,0)
 assert.equal(next.cod_destination_rates['PT-CONT'].percentage_value,9)
 assert.equal(next.cod_destination_rates['ES-PENIN'].fixed_value,5)
 assert.equal(next.cod_destination_rates['ES-BALEARES'].min_value,6)
 assert.equal(next.cod_destination_rates['PT-CONT'].use_standard,true)
})

test('COD region validation survives standard and client saves and rejects malformed or foreign-zone rates',async()=>{
 const h=setup()
 assert.equal((await h.actions.saveStandardSpecialFeesAction(regionalStandards())).success,true)
 const saved=(await h.actions.getStandardSpecialFeesAction()).fees
 assert.equal(saved[0].cod_destination_rates['PT-ILHAS'].min_value,4)
 assert.equal(saved.find(f=>f.special_service_code==='correos_cod').cod_destination_rates['ES-BALEARES'].min_value,6)
 const clients=h.load('app/actions/clientes.ts')
 const client=(await clients.getClientesAction(clientId))[0]
 client.pricing.special_services_fees[0].use_standard=false
 client.pricing.special_services_fees[0].cod_destination_rates['PT-ILHAS']={fee_type:'fixed',fixed_value:0,use_standard:false}
 client.pricing.special_services_fees.find(f=>f.special_service_code==='correos_cod').cod_destination_rates['ES-BALEARES']={fee_type:'fixed',fixed_value:7,use_standard:false}
 const result=await clients.saveClienteAction({...client,short_name:'Fixture'})
 assert.equal(result.success,true)
 assert.equal(result.data.pricing.special_services_fees[0].cod_destination_rates['PT-ILHAS'].fixed_value,0)
 assert.equal(result.data.pricing.special_services_fees.find(f=>f.special_service_code==='correos_cod').cod_destination_rates['ES-BALEARES'].fixed_value,7)
 for(const bad of [null,[],{'ES-ILHAS':{fee_type:'fixed',fixed_value:1}},{'PT-ILHAS':{fee_type:'fixed',fixed_value:-1}},{'PT-ILHAS':{fee_type:'percentage',percentage_value:Infinity}},{'PT-ILHAS':{fee_type:'fixed'}},{'PT-ILHAS':{fee_type:'fixed',fixed_value:1,use_standard:'yes'}}]){
  const rows=defaults.map(f=>f.special_service_code==='cod'?{...f,cod_destination_rates:bad}:f)
  assert.throws(()=>validateStandardSpecialFees(rows))
  assert.throws(()=>validateClientSpecialFees(rows))
 }
 assert.throws(()=>validateClientSpecialFees([{...defaults[1],cod_destination_rates:codRates}]))
})

test('server quotes and client previews select identical regional COD after loading standard and client overrides',async()=>{
 const h=setup({events:[settings(regionalStandards())]})
 const zones=['PT-CONT','PT-ILHAS','ES-PENIN'].map(zone_code=>({zone_code,zone_name:zone_code,tiers:[{weight_max:5,cost_price:3,sell_price:10,enabled:true}]}))
 const service=h.tables.servicos_linke[0]
 Object.assign(service,{fuel_surcharge_pct:0,zones})
 const {calculateShipmentQuote}=h.load('lib/pricing/calculate-shipment-quote.ts')
 const {calculateClientShipmentPreview}=h.load('lib/pricing/calculate-client-shipment-preview.ts')
 for(const [country,postal,commission] of [['PT','4800-019',2],['PT','9000-001',4],['PT','9500-001',4],['ES','28013',5]]){
  const ctx=await h.load('lib/pricing/shipment-pricing-context.ts').loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
  const client=(await h.load('app/actions/clientes.ts').getClientesAction(clientId))[0]
  const quote=calculateShipmentQuote(1,ctx.client,ctx.service,country,postal,['cod'],100)
  const preview=calculateClientShipmentPreview(1,client,service,country,postal,['cod'],100)
  assert.equal(quote.specialFeesAmount,commission)
  assert.equal(preview.specialFeesAmount,commission)
  assert.equal(quote.totalPrice,preview.totalPrice)
 }
})

test('Correos Ilhas Express server quotes and portal previews apply saved Baleares rates and customer exceptions',async()=>{
 const h=setup({events:[settings(regionalStandards())]})
 const {buildBalearesExpressZones}=h.load('lib/services/correos/baleares-tariffs.ts')
 const service=h.tables.servicos_linke[0]
 const zones=buildBalearesExpressZones()
 Object.assign(service,{name:'Correos Ilhas Express',code:'LK-COR-ISLAS-EXPRESS',carrier_group:'correos',
  webservice_service_code:'26',allowed_zones:zones.map(z=>z.zone_code),fuel_surcharge_pct:0,zones})
 const {loadShipmentPricingContext}=h.load('lib/pricing/shipment-pricing-context.ts')
 const {calculateShipmentQuote}=h.load('lib/pricing/calculate-shipment-quote.ts')
 const {calculateClientShipmentPreview}=h.load('lib/pricing/calculate-client-shipment-preview.ts')
 const clients=h.load('app/actions/clientes.ts')
 const verify=async expected=>{
  const ctx=await loadShipmentPricingContext(h.db.client,h.ctx,clientId,{serviceId:'service'})
  const client=(await clients.getClientesAction()).find(c=>c.id===clientId)
  for(const postal of ['07001','07701','07800','07860']) {
   const server=calculateShipmentQuote(1,ctx.client,ctx.service,'ES',postal,['correos_cod'],100)
   const preview=calculateClientShipmentPreview(1,client,service,'ES',postal,['correos_cod'],100)
   assert.equal(server.specialFeesAmount,expected)
   assert.equal(preview.specialFeesAmount,expected)
   assert.equal(preview.totalPrice,server.totalPrice)
  }
 }
 await verify(6)
 const client=(await clients.getClientesAction()).find(c=>c.id===clientId)
 client.pricing.special_services_fees.find(f=>f.special_service_code==='correos_cod').cod_destination_rates['ES-BALEARES']={fee_type:'fixed',fixed_value:7,use_standard:false}
 assert.equal((await clients.saveClienteAction(client)).success,true)
 await verify(7)
 assert.equal((await h.actions.getStandardSpecialFeesAction()).fees.find(f=>f.special_service_code==='correos_cod').cod_destination_rates['ES-BALEARES'].min_value,6)
})

for(const [carrier,code,label,zone,initialRate] of [
 ['ctt','cod','Ilhas portuguesas (Açores e Madeira)','PT-ILHAS',3],
 ['correos','correos_cod','Espanha — Ilhas Baleares','ES-BALEARES',4],
]) test(`editing and resetting ${zone} leaves other regions inherited and never writes a different fee`,()=>{
 let cursor=0,slots=[],changed
 const jsx=(type,props)=>({type,props:props||{}})
 const editor=createLoader({react:{useState:initial=>{const i=cursor++;if(slots[i]===undefined)slots[i]=initial;return[slots[i],v=>slots[i]=v]}},'react/jsx-runtime':{jsx,jsxs:jsx}})('components/shipments/SpecialFeesEditor.tsx').SpecialFeesEditor
 const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
 const standards=regionalStandards()
 const render=fees=>{cursor=0;return flat(editor({fees,standards,mode:'client',onChange:v=>changed=v}))}
 const initial=resolveClientSpecialFees(undefined,standards)
 let nodes=render(initial)
 if(carrier==='correos') {
  nodes.find(n=>n.type==='button'&&n.props['aria-pressed']===false).props.onClick()
  nodes=render(initial)
 }
 const name=defaults.find(f=>f.special_service_code===code).special_service_name
 nodes.find(n=>n.type==='input'&&n.props['aria-label']===`Percentagem de ${name} · ${label}`).props.onChange({target:{value:'7'}})
 let fee=changed.find(f=>f.special_service_code===code)
 assert.equal(fee.use_standard,true,'general rate and enabled state continue to follow standard')
 assert.equal(fee.cod_destination_rates[zone].percentage_value,7)
 assert.equal(fee.cod_destination_rates[zone].use_standard,false)
 assert.equal(fee.cod_destination_rates['PT-CONT'].use_standard,true)
 assert.equal(fee.cod_destination_rates['ES-PENIN'].use_standard,true)
 assert.deepEqual(changed.find(f=>f.special_service_code==='fragil'),initial.find(f=>f.special_service_code==='fragil'))
 const refreshed=resolveClientSpecialFees(changed,standards)
 assert.equal(refreshed.find(f=>f.special_service_code===code).cod_destination_rates[zone].percentage_value,7)
 nodes=render(refreshed)
 const reset=nodes.find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children.join('')===`Usar standard em ${label}`)
 assert.ok(reset);reset.props.onClick()
 fee=changed.find(f=>f.special_service_code===code)
 assert.equal(fee.cod_destination_rates[zone].percentage_value,initialRate)
 assert.ok(COD_DESTINATIONS.every(({code})=>fee.cod_destination_rates[code].use_standard))
})
