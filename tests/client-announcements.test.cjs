const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const T='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',U='44444444-4444-4444-8444-444444444444',M='55555555-5555-4555-8555-555555555555',OTHER='99999999-9999-4999-8999-999999999999'
const staff={user:{id:U},role:'employee',tenant_id:T,client_id:null,permissions:['Gestão de Clientes & Contratos']}
const client={...staff,role:'client',client_id:A,permissions:[]}
const announcement=(id=M,details={},tenant=T)=>({id,tenant_id:tenant,action:'client_announcement',created_at:'2026-10-29T10:00:00Z',details:{title:'Aviso',body:'Texto',level:'warning',target:'all',client_id:null,expires_at:null,active:true,sender_id:U,created_at:'2026-10-29T10:00:00Z',...details}})
function harness(ctx=staff,{rows=[],failure}={}){
 const tables={clients:[{id:A,tenant_id:T},{id:B,tenant_id:T},{id:OTHER,tenant_id:OTHER}],audit_log:rows}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const load=createLoader({'@/lib/auth/context':{getAuthContext:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>db.client}})
 const route=load('app/api/client-announcements/route.ts')
 return{db,tables,route,get:q=>route.GET(new Request(`https://app.test/api/client-announcements?${q}`)),post:(body,origin='https://app.test')=>route.POST(new Request('https://app.test/api/client-announcements',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}))}
}
const publication={action:'publish',requestId:M,target:'all',level:'warning',title:'Atrasos nas ilhas',body:'Consulte os prazos antes de enviar.'}
test('all-account announcements persist once and are visible in both stores without sending email or creating duplicate messages',async()=>{
 const h=harness()
 assert.equal((await h.post(publication)).status,200)
 assert.equal((await h.post(publication)).status,200)
 assert.equal(h.db.writes.filter(w=>w.table==='audit_log'&&w.kind==='insert').length,1)
 for(const id of [A,B]){
  const reader=harness({...client,client_id:id},{rows:h.tables.audit_log})
  const response=await reader.get(`clientId=${id}`),data=await response.json()
  assert.equal(response.status,200);assert.equal(data.notices.length,1);assert.equal(data.notices[0].title,publication.title)
  assert.equal(data.notices[0].sender_id,undefined)
  assert.match(response.headers.get('cache-control'),/no-store/)
 }
})
test('targeted, expired, withdrawn and foreign-company notices never leak into another store',async()=>{
 const expired=new Date(Date.now()-3600000).toISOString()
 const h=harness(client,{rows:[announcement(M,{target:'client',client_id:B}),announcement(A,{expires_at:expired}),announcement(B,{active:false}),announcement(OTHER,{},OTHER)]})
 const data=await(await h.get(`clientId=${A}`)).json()
 assert.deepEqual(data.notices,[])
 assert.equal((await h.get(`clientId=${B}`)).status,403)
 assert.equal((await h.get('manage=1')).status,403)
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===T)))
})
test('only permitted staff can publish/withdraw; same-origin and input validation are enforced',async()=>{
 for(const ctx of [null,client,{...staff,permissions:[]}]){
  const h=harness(ctx)
  assert.ok([401,403].includes((await h.post(publication)).status))
  assert.equal(h.db.writes.length,0)
 }
 const h=harness()
 assert.equal((await h.post(publication,'https://evil.test')).status,403)
 for(const extra of [{level:'dangerous'},{target:'invalid'},{title:''},{body:'x'.repeat(4001)},{requestId:'bad'},{target:'client',clientId:OTHER},{expiresAt:'invalid'},{expiresAt:'2020-01-01T00:00:00Z'}])assert.ok((await h.post({...publication,...extra})).status>=400)
 assert.equal(h.db.writes.length,0)
})
test('a specific-store banner reaches only that store; staff can withdraw it without deleting the history',async()=>{
 const h=harness()
 assert.equal((await h.post({...publication,target:'client',clientId:A})).status,200)
 assert.equal((await h.post({action:'withdraw',id:M})).status,200)
 assert.equal(h.tables.audit_log.length,1)
 assert.equal(h.tables.audit_log[0].details.active,false)
 const history=await(await h.get('manage=1')).json()
 assert.equal(history.notices[0].active,false)
 const reader=harness(client,{rows:h.tables.audit_log})
 assert.deepEqual((await(await reader.get(`clientId=${A}`)).json()).notices,[])
 assert.equal((await h.post(publication)).status,409)
})
test('idempotency prevents changed-content replay and cross-tenant withdrawal; persistence failures return an error',async()=>{
 const h=harness({ ...staff, role:'admin' },{rows:[announcement()]})
 assert.equal((await h.post({...publication,title:'Changed'})).status,409)
 assert.equal((await h.post({action:'withdraw',id:OTHER})).status,404)
 const failed=harness(staff,{failure:q=>q.write?{message:'PRIVATE DB ERROR'}:null})
 const response=await failed.post(publication)
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE DB/)
})
test('visibility uses expiration and store targeting even before the next polling response',()=>{
 const {announcementIsVisible}=createLoader({})('lib/client-messages/announcements.ts')
 const base={id:M,target:'all',clientId:null,active:true,expiresAt:null}
 assert.equal(announcementIsVisible(base,A),true)
 assert.equal(announcementIsVisible({...base,target:'client',clientId:B},A),false)
 assert.equal(announcementIsVisible({...base,expiresAt:new Date(1000).toISOString()},A,1000),false)
 assert.equal(announcementIsVisible({...base,expiresAt:'invalid'},A),false)
})
