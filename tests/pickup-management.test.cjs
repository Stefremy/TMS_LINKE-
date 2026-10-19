const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const { validatePickupSearch, mapLocalPickup, normalizePickupObjects } = createLoader({})('lib/pickup-management.ts')
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

function actions(tables = {}, denied = false, failure, remote = {}) {
  const db = fakeSupabase(tables, failure)
  let carrierCalls = 0
  const load = createLoader({
    '@/lib/auth/context': {requireEmployee:async()=>{if(denied) throw new Error('Forbidden');return {user:{id:'staff-id',email:'operator@example.test'},colaborador_id:'staff'}},getTenantId:async()=>'own'},
    'next/cache': {revalidatePath(){}},
    '@/lib/supabase/server': {createAdminClient:()=>db.createAdminClient()},
    '@/lib/services/carriers/credentials': {resolveCttCredentials:async()=>{carrierCalls++;return {}}},
    '@/lib/services/ctt/ctt-pickup-read.service': {CTTPickupReadService:class {async search(){return []} async details(){if(remote.error) throw new Error(remote.error);return remote.pickup || own}}},
  })
  return { api:load('app/actions/pickups.ts'), db, calls:()=>carrierCalls }
}

test('all pickup actions refuse client accounts before any database or carrier access', async () => {
  const {api,db,calls} = actions({},true)
  for(const call of [()=>api.searchPickupsAction(),()=>api.getPickupDetailsAction(ownId),()=>api.searchCttPickupsAction({reference:'123'}),()=>api.getCttPickupDetailsAction('123'),()=>api.markPickupCollectedAction(ownId),()=>api.refreshPickupParcelsAction(ownId)]) await assert.rejects(call,/Forbidden/)
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

test('manual collection updates only the owned pickup, retains details and records trusted actor and time', async () => {
  const tables={recolhas:[{...own},{...own,id:otherId,tenant_id:'other'}],audit_log:[{tenant_id:'own',action:'recolha_data',details:{recolha_id:ownId,sender_name:'Saved sender'}}]}
  const {api,db,calls}=actions(tables)
  const result=await api.markPickupCollectedAction(ownId)
  assert.equal(result.success,true);assert.equal(result.pickup.status,'Realizado');assert.equal(result.pickup.sender_name,'Saved sender')
  assert.equal(tables.recolhas[0].status,'Realizado');assert.equal(tables.recolhas[1].status,'Agendado')
  const audit=db.writes.find(w=>w.table==='audit_log').value
  assert.equal(audit.action,'recolha_manual_confirmation');assert.equal(audit.details.confirmed_by,'operator@example.test')
  assert.equal(audit.details.user_id,'staff-id');assert.equal(audit.details.source,'manual');assert.ok(Number.isFinite(Date.parse(audit.details.confirmed_at)))
  // Inserts in the fake DB intentionally don't emulate persisted rows.
  tables.audit_log.push(audit)
  const detail=await api.getPickupDetailsAction(ownId)
  assert.deepEqual(detail.pickup.manual_confirmation,result.pickup.manual_confirmation)
  const before=db.writes.length
  assert.equal((await api.markPickupCollectedAction(ownId)).success,true)
  assert.equal(db.writes.length,before,'repeat confirmations must not overwrite the original attribution')
  assert.equal(calls(),0)
})

test('manual collection rejects foreign/missing pickups, cancellation and invalid IDs without writes', async () => {
  const {api,db}=actions({recolhas:[{...own,id:otherId,tenant_id:'other'},{...own,status:'Cancelado'}]})
  for(const id of [otherId,ownId,'not-a-uuid','cccccccc-cccc-cccc-cccc-cccccccccccc']) assert.equal((await api.markPickupCollectedAction(id)).success,false)
  assert.deepEqual(db.writes,[])
})

test('failed audit persistence restores the previous status and never claims success', async () => {
  const tables={recolhas:[{...own}],audit_log:[]}
  const {api}=actions(tables,false,q=>q.table==='audit_log' && q.write ? {message:'Audit unavailable'} : undefined)
  const result=await api.markPickupCollectedAction(ownId)
  assert.equal(result.success,false);assert.match(result.error,/reposto/);assert.equal(tables.recolhas[0].status,'Agendado')
})

test('a concurrent status change is not overwritten or audited as completed', async () => {
  const tables={recolhas:[{...own}],audit_log:[]}
  const {api,db}=actions(tables,false,q=>{if(q.table==='recolhas' && q.write) tables.recolhas[0].status='Cancelado'})
  const result=await api.markPickupCollectedAction(ownId)
  assert.equal(result.success,false);assert.equal(tables.recolhas[0].status,'Cancelado')
  assert.equal(db.writes.filter(w=>w.table==='audit_log').length,0)
})

test('object codes handle singleton, duplicates and nil XML without inventing tracking codes', () => {
  assert.deepEqual(normalizePickupObjects(' eq123456789pt '),['EQ123456789PT'])
  assert.deepEqual(normalizePickupObjects(['EQ123456789PT','eq123456789pt',null,{'@_i:nil':'true'},'', 'not a code']),['EQ123456789PT'])
  assert.deepEqual(normalizePickupObjects({'@_i:nil':'true'}),[])
})

test('CTT object refresh saves only exact confirmed associations and reloads the latest tenant snapshot', async () => {
  const tables={recolhas:[{...own}],audit_log:[
    {tenant_id:'other',action:'recolha_ctt_objects',created_at:'2099-01-01',details:{recolha_id:ownId,pickup_id:own.ctt_pickup_id,objects:['FOREIGN']}},
    {tenant_id:'own',action:'recolha_ctt_objects',created_at:'2020-01-01',details:{recolha_id:ownId,pickup_id:own.ctt_pickup_id,objects:['OLD']}},
  ]}
  const {api,db,calls}=actions(tables,false,undefined,{pickup:{...own,objects:['EQ123456789PT','EQ123456789PT','DB123456789PT']}})
  const result=await api.refreshPickupParcelsAction(ownId)
  assert.equal(result.success,true);assert.deepEqual(result.pickup.objects,['EQ123456789PT','DB123456789PT'])
  assert.equal(tables.recolhas[0].status,'Agendado','objects do not prove completed collection')
  const snapshot=db.writes.find(w=>w.table==='audit_log').value
  assert.equal(snapshot.action,'recolha_ctt_objects');assert.equal(snapshot.details.recolha_id,ownId);assert.equal(snapshot.details.source,'ctt_get_recolha')
  tables.audit_log.push({...snapshot,created_at:result.pickup.objects_checked_at})
  const detail=await api.getPickupDetailsAction(ownId)
  assert.deepEqual(detail.pickup.objects,result.pickup.objects);assert.equal(detail.pickup.objects_checked_at,result.pickup.objects_checked_at)
  assert.equal(calls(),1);assert.equal(db.writes.length,1)
})

test('object refresh rejects foreign pickups and mismatched carrier references without saving links', async () => {
  const foreign=actions({recolhas:[{...own,id:otherId,tenant_id:'other'}]})
  assert.equal((await foreign.api.refreshPickupParcelsAction(otherId)).success,false);assert.equal(foreign.calls(),0);assert.deepEqual(foreign.db.writes,[])
  const mismatch=actions({recolhas:[{...own}]},false,undefined,{pickup:{...own,ctt_pickup_id:'999/26',objects:['EQ123456789PT']}})
  assert.equal((await mismatch.api.refreshPickupParcelsAction(ownId)).success,false);assert.deepEqual(mismatch.db.writes,[])
})

test('permission failure preserves the last confirmed list and a successful empty response replaces it', async () => {
  const tables={recolhas:[{...own}],audit_log:[{tenant_id:'own',action:'recolha_ctt_objects',created_at:'2020-01-01',details:{recolha_id:ownId,pickup_id:own.ctt_pickup_id,objects:['EQ123456789PT'],checked_at:'2020-01-01T00:00:00Z'}}]}
  const refused=actions(tables,false,undefined,{error:'Utilizador não tem permissões'})
  assert.equal((await refused.api.refreshPickupParcelsAction(ownId)).success,false);assert.deepEqual(refused.db.writes,[])
  assert.deepEqual((await refused.api.getPickupDetailsAction(ownId)).pickup.objects,['EQ123456789PT'])
  const empty=actions(tables,false,undefined,{pickup:{...own,objects:[]}})
  const result=await empty.api.refreshPickupParcelsAction(ownId)
  assert.equal(result.success,true);assert.deepEqual(result.pickup.objects,[])
  tables.audit_log.push({...empty.db.writes[0].value,created_at:result.pickup.objects_checked_at})
  assert.deepEqual((await empty.api.getPickupDetailsAction(ownId)).pickup.objects,[])
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
