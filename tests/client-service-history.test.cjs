const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {fakeSupabase} = require('./helpers/fake-supabase.cjs')
const helpers = createLoader({})('lib/clients/service-history.ts')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('CSV preserves zeroes, large counts and duplicate names as distinct source rows',()=>{
  const rows=helpers.parseLegacyServiceCounts('\uFEFFLoja;N.º de serviços\r\n"Loja; A";0\r\nMODA VERA;6\r\nMODA VERA;22\r\nJOIAS BRILHANTES;7191\r\n')
  assert.deepEqual(rows.map(r=>r.count),[0,6,22,7191])
  assert.equal(rows[0].name,'Loja; A')
  assert.equal(rows[2].row,4)
  assert.equal(helpers.normalizeLegacyClientName(' ♡ Belíssima Loja Online ♡ '),'belissimalojaonline')
})
test('CSV rejects missing, negative, fractional or unsafe counts instead of silently importing zero',()=>{
  for(const raw of ['','-1','3.5','abc','9007199254740992'])assert.throws(()=>helpers.parseLegacyServiceCounts(`Loja;N.º de serviços\nLoja;${raw}`),/inválido/)
  assert.throws(()=>helpers.parseLegacyServiceCounts('Loja;Total\nLoja;0'),/Cabeçalho/)
})
test('valid zero history is distinct from a missing or corrupt snapshot',()=>{
  assert.equal(helpers.readLegacyServiceHistory({count:0,source:'lojas_servicos.csv',imported_at:'2026-10-30T11:00:00Z'}).count,0)
  for(const details of [null,{count:-1},{count:'0'},{count:0,source:'a',imported_at:'bad'}])assert.equal(helpers.readLegacyServiceHistory(details),null)
})
function harness({tenant='tenant',logs=[],failure,authorized=true,shipments=[]}={}){
 const db=fakeSupabase({clients:[{id:A,tenant_id:'tenant'},{id:B,tenant_id:'other'}],audit_log:logs,shipments},failure)
 const load=createLoader({'@/lib/auth/context':{requireEmployee:async()=>{if(!authorized)throw Error('Forbidden');return {tenant_id:tenant}}},'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()}})
 return {read:load('app/actions/client-service-history.ts').getClientServiceHistoryAction,readTotal:load('app/actions/client-service-history.ts').getClientTotalServicesAction,db}
}
function row(id,count,date,tenant_id='tenant'){return {id:date,tenant_id,action:'client_legacy_service_count',created_at:date,details:{id,count,source:'lojas_servicos.csv',imported_at:date}}}
test('staff read only the latest snapshot, including an updated zero, without adding repeated imports',async()=>{
 const h=harness({logs:[row(A,30,'2026-10-29'),row(A,0,'2026-10-30'),row(A,999,'2026-10-31','other')]})
 assert.equal((await h.read(A)).count,0)
 assert.equal(h.db.writes.length,0)
 assert.equal(await harness().read(A),null)
})
test('history requires staff authorization and a customer registered in the current tenant',async()=>{
 await assert.rejects(harness({authorized:false}).read(A),/Forbidden/)
 await assert.rejects(harness().read(B),/não encontrado/)
 await assert.rejects(harness().read('bad'),/inválido/)
})
test('read failures are exposed, never presented as zero services or absent history',async()=>{
 await assert.rejects(harness({failure:q=>q.table==='audit_log'?{message:'unavailable'}:null}).read(A),/Não foi possível consultar/)
 await assert.rejects(harness({logs:[row(A,-1,'2026-10-30')]}).read(A),/incompleto/)
})

test('the modal shows only the total number, including zero, without legacy import descriptions',()=>{
 const jsx=(type,props)=>({type,props})
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'')
 function render(total){let cursor=0;const values=[{total},false,'',0]
  const load=createLoader({react:{useState:()=>[values[cursor++],()=>{}],useEffect:()=>{}},'react/jsx-runtime':{jsx,jsxs:jsx},'@/app/actions/client-service-history':{getClientTotalServicesAction:async()=>({total})}})
  return text(load('app/ops/entidades/clientes/components/ClientServiceHistory.tsx').ClientServiceHistory({clientId:A}))
 }
 assert.match(render(0),/N.º de serviços totais0/)
 assert.match(render(42),/N.º de serviços totais42/)
 assert.doesNotMatch(render(0),/plataforma anterior|Sem dados importados|contagem associada|Período|separadamente/)
})
test('total services combine the latest historical snapshot and all native shipments of this client and tenant only',async()=>{
 const shipments=[{id:'one',tenant_id:'tenant',client_id:A},{id:'two',tenant_id:'tenant',client_id:A},{id:'other-store',tenant_id:'tenant',client_id:B},{id:'other-company',tenant_id:'other',client_id:A}]
 const h=harness({logs:[row(A,100,'2026-10-29'),row(A,30,'2026-10-30')],shipments})
 assert.deepEqual(await h.readTotal(A),{total:32})
 assert.deepEqual(await harness({shipments}).readTotal(A),{total:2})
 assert.deepEqual(await harness().readTotal(A),{total:0})
 assert.equal(h.db.writes.length,0)
 const query=h.db.queries.find(q=>q.table==='shipments')
 assert.ok(query.filters.some(f=>f.field==='client_id'&&f.value===A));assert.ok(query.filters.some(f=>f.field==='tenant_id'&&f.value==='tenant'))
})
test('total service failures never appear as zero, and the total remains staff-only and tenant-scoped',async()=>{
 await assert.rejects(harness({authorized:false}).readTotal(A),/Forbidden/)
 await assert.rejects(harness().readTotal(B),/não encontrado/)
 await assert.rejects(harness({failure:q=>q.table==='shipments'?{message:'offline'}:null}).readTotal(A),/Não foi possível consultar/)
 await assert.rejects(harness({logs:[row(A,-1,'2026-10-30')]}).readTotal(A),/incompleto/)
})
