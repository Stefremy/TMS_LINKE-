const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const load=createLoader({})
const {clientActivityColor,applyClientActivityColor,CLIENT_ACTIVITY_COLORS}=load('lib/clients/activity-color.ts')

test('color bands preserve exact boundaries from cold zero to warm high activity',()=>{
 const samples=[[0,0],[1,1],[9,1],[10,2],[49,2],[50,3],[199,3],[200,4],[999,4],[1000,5],[100000,5]]
 for(const [count,band]of samples)assert.equal(clientActivityColor(count),CLIENT_ACTIVITY_COLORS[band].color)
 for(const count of [undefined,-1,NaN,Infinity,1.5])assert.equal(clientActivityColor(count),undefined)
})
test('unknown counts preserve the existing color and manual choices survive higher activity',()=>{
 const original={color:'#123456',is_active:true}
 assert.equal(applyClientActivityColor(original,undefined),original)
 assert.equal(applyClientActivityColor(original,0).color,CLIENT_ACTIVITY_COLORS[0].color)
 const manual=applyClientActivityColor({...original,color_mode:'manual'},7191)
 assert.equal(manual.color,'#123456')
 assert.equal(manual.legacy_service_count,7191)
 assert.equal(original.color,'#123456')
})

test('the customer reader derives colors from the latest tenant-scoped history without replacing profiles or writing financial data',async()=>{
 const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 const profile=(id,color_mode)=>({id,action:'client_data',tenant_id:'tenant',details:{id,short_name:id,color:'#123456',color_mode,is_active:true,credit_limit:500}})
 const history=(id,count,date,tenant_id='tenant')=>({id:date,action:'client_legacy_service_count',created_at:date,tenant_id,details:{id,count,source:'lojas_servicos.csv',imported_at:date}})
 const tables={clients:[{id:A,tenant_id:'tenant'},{id:B,tenant_id:'tenant'}],audit_log:[profile(A),profile(B,'manual'),history(A,4,'2026-10-29'),history(A,1000,'2026-10-30'),history(A,0,'2026-10-31','foreign'),history(B,0,'2026-10-30')]}
 const db=fakeSupabase(tables)
 const actions=createLoader({'@/lib/auth/context':{requireUser:async()=>({role:'admin',tenant_id:'tenant'})},'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},'next/cache':{revalidatePath(){}},'next/navigation':{redirect(){}}})('app/actions/clientes.ts')
 const customers=await actions.getClientesAction()
 const auto=customers.find(c=>c.id===A),manual=customers.find(c=>c.id===B)
 assert.equal(auto.color,CLIENT_ACTIVITY_COLORS[5].color)
 assert.equal(auto.legacy_service_count,1000)
 assert.equal(auto.short_name,A)
 assert.equal(auto.credit_limit,500)
 assert.equal(auto.color_mode,'services')
 assert.equal(manual.color,'#123456')
 assert.equal(manual.legacy_service_count,0)
 assert.equal(db.writes.length,0)
 assert.equal(tables.audit_log[0].details.color,'#123456')
})
