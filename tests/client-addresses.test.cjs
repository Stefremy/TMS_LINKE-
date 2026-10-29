const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {getClientBillingAddress:get,usesPrincipalBillingAddress:same,normalizeClientBillingFields:normalize,invoiceBillingAddress:invoice,billingFieldsFromLegacyRow:legacy}=createLoader({})('lib/client-addresses.ts')
const pickup={address:'Armazém, 12',postal_code:'4800-019',city:'Guimarães',country_code:'PT'}
const fiscal={billing_same_as_pickup:false,billing_address:'Sede fiscal, 30',billing_postal_code:'28001',billing_city:'Madrid',billing_country_code:'ES'}
test('legacy clients keep their principal address; same-address mode follows later pickup changes',()=>{
 assert.equal(same(pickup),true);assert.deepEqual(get(pickup),pickup)
 assert.equal(get({...pickup,...fiscal,billing_same_as_pickup:true,address:'Nova recolha'}).address,'Nova recolha')
})
test('a separate fiscal address is never mixed with pickup fields and UK normalizes to GB',()=>{
 assert.deepEqual(get({...pickup,...fiscal}),{address:'Sede fiscal, 30',postal_code:'28001',city:'Madrid',country_code:'ES'})
 assert.equal(get({...pickup,...fiscal,billing_country_code:' uk '}).country_code,'GB')
 assert.equal(get({...pickup,...fiscal,billing_city:''}).city,'')
 assert.throws(()=>invoice({...pickup,...fiscal,billing_city:''}),/morada de faturação/)
 assert.equal(get(pickup).address,pickup.address)
})
test('fiscal fields survive normalization and omitted flags infer a separate address',()=>{
 assert.equal(same({...pickup,billing_address:'Fiscal'}),false)
 assert.equal(normalize({...fiscal,billing_address:'  Fiscal  '}).billing_address,'Fiscal')
 assert.throws(()=>normalize({billing_same_as_pickup:'false'}),/morada/)
})
test('legacy export backfill preserves both addresses and does not invent a missing fiscal address',()=>{
 const row={Morada:'Armazém', 'Código Postal':'4800-019',Localidade:'Guimarães',País:'pt','Morada Faturação':'Fiscal','Código Postal Faturação':'4000-001','Localidade Faturação':'Porto','País Faturação':'pt'}
 const separate=legacy(row);assert.equal(separate.billing_same_as_pickup,false);assert.equal(separate.billing_address,'Fiscal')
 const equal=legacy({...row,'Morada Faturação':'Armazém','Código Postal Faturação':'4800-019','Localidade Faturação':'GUIMARÃES'})
 assert.equal(equal.billing_same_as_pickup,true)
 const blank=legacy({País:'pt','País Faturação':'pt'});assert.equal(blank.billing_same_as_pickup,false);assert.equal(blank.billing_address,'')
})
