const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const { validatePickupSearch, mapLocalPickup } = createLoader({})('lib/pickup-management.ts')
const ownId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const otherId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const own = { id: ownId, tenant_id: 'own', ctt_pickup_id: '1519176/26', scheduled_date: '2026-10-19', status: 'Agendado' }

test('date filters reject impossible, incomplete and reversed dates; carrier enforces 60 days', () => {
  for (const input of [{dateFrom:'2026-02-30',dateTo:'2026-03-01'}, {dateFrom:'2026-10-20',dateTo:'2026-10-19'}, {dateFrom:'2026-10-19'}, {page:-1}]) assert.ok(validatePickupSearch(input))
  const long = {dateFrom:'2026-01-01',dateTo:'2026-12-31'}
  assert.equal(validatePickupSearch(long), undefined)
  assert.ok(validatePickupSearch(long, true))
  assert.equal(validatePickupSearch({...long,reference:'1519176/26'}, true), undefined)
  assert.equal(validatePickupSearch({dateFrom:'2026-01-01',dateTo:'2026-03-01'}, true), undefined)
  assert.ok(validatePickupSearch({dateFrom:'2026-01-01',dateTo:'2026-03-02'}, true))
  assert.ok(validatePickupSearch({}, true))
})

test('saved status stays authoritative and missing historical contacts are not invented', () => {
  const pickup = mapLocalPickup(own, {status:'Cancelado', sender_name:'Historic sender', weight_kg:3})
  assert.equal(pickup.status,'Agendado')
  assert.equal(pickup.sender_name,'Historic sender')
  assert.equal(pickup.sender_phone,'')
  assert.equal(pickup.weight_kg,3)
})

function actions(tables = {}, denied = false) {
  const db = fakeSupabase(tables)
  let carrierCalls = 0
  const load = createLoader({
    '@/lib/auth/context': {requireEmployee:async()=>{if(denied) throw new Error('Forbidden')},getTenantId:async()=>'own'},
    '@/lib/supabase/server': {createAdminClient:()=>db.createAdminClient()},
    '@/lib/services/carriers/credentials': {resolveCttCredentials:async()=>{carrierCalls++;return {}}},
    '@/lib/services/ctt/ctt-pickup-read.service': {CTTPickupReadService:class {async search(){return []} async details(){return own}}},
  })
  return { api:load('app/actions/pickups.ts'), db, calls:()=>carrierCalls }
}

test('all pickup actions refuse client accounts before any database or carrier access', async () => {
  const {api,db,calls} = actions({},true)
  for(const call of [()=>api.searchPickupsAction(),()=>api.getPickupDetailsAction(ownId),()=>api.searchCttPickupsAction({reference:'123'}),()=>api.getCttPickupDetailsAction('123')]) await assert.rejects(call,/Forbidden/)
  assert.equal(db.queries.length,0); assert.equal(calls(),0)
})

test('search and details isolate the company and fetch matching historical metadata beyond recent logs', async () => {
  const {api,db} = actions({recolhas:[own,{...own,id:otherId,tenant_id:'other'}],audit_log:[
    ...Array.from({length:150},(_,i)=>({tenant_id:'own',action:'recolha_data',created_at:'2026-10-20',details:{pickup_id:`other-${i}`}})),
    {tenant_id:'own',action:'recolha_data',created_at:'2026-10-19',details:{pickup_id:own.ctt_pickup_id,sender_name:'Own store',sender_mobile:'910000001'}},
    {tenant_id:'other',action:'recolha_data',created_at:'2026-10-21',details:{pickup_id:own.ctt_pickup_id,sender_name:'Other store'}},
  ]})
  const result = await api.searchPickupsAction({dateFrom:'2026-10-19',dateTo:'2026-10-19'})
  assert.equal(result.success,true); assert.equal(result.total,1)
  assert.equal(result.pickups[0].sender_name,'Own store')
  const detail = await api.getPickupDetailsAction(ownId)
  assert.equal(detail.pickup.sender_mobile,'910000001')
  assert.equal((await api.getPickupDetailsAction(otherId)).success,false)
  for(const query of db.queries) assert.ok(query.filters.some(f=>f.field==='tenant_id' && f.value==='own'))
  assert.deepEqual(db.writes,[])
})

test('history paginates beyond the recent list and reports the full filtered count', async () => {
  const {api} = actions({recolhas:Array.from({length:65},(_,i)=>({...own,id:`id-${i}`,ctt_pickup_id:`ref-${i}`}))})
  const first = await api.searchPickupsAction()
  const next = await api.searchPickupsAction({page:1})
  assert.equal(first.total,65); assert.equal(first.pickups.length,50)
  assert.equal(next.total,65); assert.equal(next.pickups.length,15)
  assert.equal(new Set([...first.pickups,...next.pickups].map(p=>p.id)).size,65)
})

const creds = {client_number:'client&1',contract_number:'contract',auth_id:'secret',environment:'production'}
function service(response) {
  const calls=[]
  class Soap {
    static escapeXml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;') }
    async callSoap(input) { calls.push(input); return response }
  }
  const {CTTPickupReadService} = createLoader({'./ctt-soap-client':{CTTSoapClient:Soap}})('lib/services/ctt/ctt-pickup-read.service.ts')
  return {api:new CTTPickupReadService(),calls}
}

test('CTT search uses the published operation, ordered parameters, escaping and singleton result mapping', async () => {
  const {api,calls}=service({PesquisaRecolhasResponse:{PesquisaRecolhasResult:{_recolhas:{RecolhasListBE:{_IDRecolha:'1519176/26',_Data:'2026-10-19',_QuantObj:'2'}}}}})
  const result=await api.search(creds,{reference:'1519176/26',dateFrom:'2026-01-01',dateTo:'2026-12-31'})
  assert.equal(result[0].ctt_pickup_id,'1519176/26'); assert.equal(result[0].volumes,2)
  assert.ok(calls[0].action.endsWith('/PesquisaRecolhas'))
  assert.match(calls[0].soapBodyXml, /<tem:NumCliente>client&amp;1<\/tem:NumCliente><tem:NumContrato>contract<\/tem:NumContrato><tem:ID>secret<\/tem:ID><tem:dtInicio><\/tem:dtInicio><tem:dtFim><\/tem:dtFim>/)
})

test('CTT detail maps weight in grams and never turns carrier errors into success', async () => {
  const {api,calls}=service({GetRecolhaResponse:{GetRecolhaResult:{_recolhas:{_IDRecolha:'1519176/26',_Peso:'1500',_CP4Exp:'4800',_CP3Exp:'019',_TelefoneExp:{'@_i:nil':'true'},_Objectos:{string:['A','B']}}}}})
  const detail=await api.details(creds,'1519176/26')
  assert.equal(detail.weight_kg,1.5); assert.equal(detail.sender_zip,'4800-019'); assert.deepEqual(detail.objects,['A','B'])
  assert.equal(detail.sender_phone,'')
  assert.ok(calls[0].action.endsWith('/GetRecolha'))
  const refused=service({GetRecolhaResponse:{GetRecolhaResult:{_erros:{string:'Invalid authentication'}}}})
  await assert.rejects(()=>refused.api.details(creds,'1519176/26'),/Invalid authentication/)
  await assert.rejects(()=>api.details(creds,'<invalid>'),/inválida/)
  assert.equal(calls.length,1)
  const empty=service({})
  await assert.rejects(()=>empty.api.details(creds,'1519176/26'),/vazia/)
  await assert.rejects(()=>empty.api.search(creds,{}),/intervalo/)
  assert.equal(empty.calls.length,1)
})
