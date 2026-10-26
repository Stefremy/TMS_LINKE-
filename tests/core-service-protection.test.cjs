const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const T = '11111111-1111-1111-1111-111111111111'
const types = createLoader({})('app/ops/configuracao/servicos/types.ts')
const fixture = { id:'custom-a', code:'LK-CUSTOM-A', name:'Fixture table', is_active:true,
  is_primordial:false, category:'Nacional', pricing_profile:'Standard / Geral', global_markup_pct:20,
  fuel_surcharge_pct:12, zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers:[{
    id:'tier-a',weight_max:1,cost_price:10,sell_price:12,margin_pct:20,delivery_time:'48h',enabled:true,
  }]}] }
function harness({ service=fixture, auditOnly=false, failure, role='admin' }={}) {
  const tables={ servicos_linke:auditOnly?[]:[service], audit_log:[{ id:'profile',tenant_id:T,
    action:'servicos_linke_data',details:service }] }
  const db=fakeSupabase(tables,failure,{persistInserts:true})
  const ctx={role,tenant_id:T,user:{email:'stefano@linke.pt'},colaborador_id:'col-stefano-001'}
  const employee=async()=>{if(!['admin','employee'].includes(role))throw Error('Unauthorized');return ctx}
  const load=createLoader({
    'next/cache':{revalidatePath(){}},'@/lib/supabase/server':{createAdminClient:()=>db.client},
    '@/lib/auth/context':{requireEmployee:employee,requireUser:async()=>ctx,getTenantId:async()=>T},
    '@/app/actions/fornecedores':{},'@/app/actions/ctt':{},
    '@/lib/services/geo/international-zones':{buildOfficialLinkeInternationalZones:()=>[],buildOfficialCeTruckZones:()=>[]},
  })
  return {actions:load('app/actions/servicos-linke.ts'),db,tables}
}
test('all built-in core IDs and codes remain protected even with a forged false flag or a renamed service',()=>{
  for(const id of types.PRIMORDIAL_SERVICE_IDS) assert.equal(types.isPrimordialServico({id,name:'Renamed',code:'changed',is_primordial:false}),true)
  for(const code of types.PRIMORDIAL_SERVICE_CODES) assert.equal(types.isPrimordialServico({id:'other',code:` ${code.toLowerCase()} `,is_primordial:false}),true)
  assert.equal(types.isPrimordialServico(fixture),false)
})
for(const role of ['admin','employee']) test(`${role}: base service tables can be deleted and stay out of the catalogue`,async()=>{
  for(const id of types.PRIMORDIAL_SERVICE_IDS){
    const h=harness({role,service:{...fixture,id,is_primordial:true}})
    const result=await h.actions.deleteServicoLinkeAction(id)
    assert.equal(result.success,true)
    assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===id),false)
    assert.equal(h.db.writes[0].value.action,'deleted_servico_linke')
  }
})
for(const auditOnly of [false,true]) test(`base flags allow deletion in ${auditOnly?'audit fallback':'native storage'}`,async()=>{
  const h=harness({auditOnly,service:{...fixture,is_primordial:true}})
  assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,true)
  assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===fixture.id),false)
})
test('editing or renaming a protected service cannot clear its core flag or change its supplied prices',async()=>{
  const h=harness({auditOnly:true,service:{...fixture,is_primordial:true}})
  const saved=await h.actions.saveServicoLinkeAction({...fixture,name:'New label',code:'NEW-CODE',is_primordial:false})
  assert.equal(saved.success,true);assert.equal(saved.data.is_primordial,true)
  assert.equal(saved.data.name,'New label');assert.equal(saved.data.zones[0].tiers[0].sell_price,12)
  assert.equal(saved.data.zones[0].tiers[0].cost_price,10)
  assert.equal(h.db.writes.find(w=>w.kind==='upsert').value.is_primordial,true)
})
test('a stored base service code allows deletion with an arbitrary ID',async()=>{
  const h=harness({service:{...fixture,code:'LK-DD-STD',is_primordial:false}})
  assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,true)
  assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===fixture.id),false)
})
test('native schemas without the protection column still save prices and retain the marker in the audit snapshot',async()=>{
  const h=harness({failure:q=>q.table==='servicos_linke'&&q.write?.kind==='upsert'&&'is_primordial' in q.write.value
    ? {code:'PGRST204',message:"Could not find the 'is_primordial' column"}:null})
  const result=await h.actions.saveServicoLinkeAction({...fixture,id:'srv_linke_dd_std',is_primordial:false})
  assert.equal(result.data.is_primordial,true)
  assert.equal(h.db.writes.find(w=>w.kind==='upsert').value.zones[0].tiers[0].sell_price,12)
  assert.equal(h.db.writes.find(w=>w.kind==='insert'&&w.value.action==='servicos_linke_data').value.details.is_primordial,true)
})
test('lookup failures refuse deletion before mutation',async()=>{
  for(const table of ['servicos_linke','audit_log']){
    const h=harness({failure:q=>q.table===table&&!q.write?{code:'08006',message:'Connection unavailable'}:null})
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,false)
    assert.equal(h.db.writes.length,0)
  }
})
test('legacy missing native table or UUID mismatch still permits audit-only base deletion',async()=>{
  for(const code of ['PGRST205','22P02']){
    const h=harness({auditOnly:true,service:{...fixture,is_primordial:true},failure:q=>q.table==='servicos_linke'?{code}:null})
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,true)
    assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===fixture.id),false)
  }
})
test('a default-only base table stays deleted across repeated catalogue reads',async()=>{
  const h=harness({auditOnly:true})
  const id='srv_linke_dd_std'
  assert.ok((await h.actions.getServicosLinkeAction()).some(s=>s.id===id))
  assert.equal((await h.actions.deleteServicoLinkeAction(id)).success,true)
  for(let i=0;i<2;i++) assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===id),false)
})
test('failure to persist deletion leaves the original table intact',async()=>{
  for(const throws of [false,true]){
    const h=harness({failure:q=>{
      if(q.table!=='audit_log'||q.write?.kind!=='insert')return null
      if(throws)throw Error('Connection unavailable')
      return {code:'08006',message:'Connection unavailable'}
    }})
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,false)
    assert.equal(h.db.writes.length,0)
    assert.ok((await h.actions.getServicosLinkeAction()).some(s=>s.id===fixture.id))
  }
})
test('a tombstone keeps referenced native rows hidden when physical cleanup fails',async()=>{
  const h=harness({failure:q=>q.write?.kind==='delete'?{code:'23503',message:'Referenced row'}:null})
  assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,true)
  assert.equal(h.tables.servicos_linke.length,1)
  assert.equal((await h.actions.getServicosLinkeAction()).some(s=>s.id===fixture.id),false)
})
test('a new variant is not made core merely because its source table is core',async()=>{
  const h=harness({service:{...fixture,is_primordial:true}})
  const result=await h.actions.duplicateServicoForClientAction(fixture.id,'Tabela Negociada Cliente','Fixture Client',0)
  assert.equal(result.success,true);assert.equal(result.data.is_primordial,false)
  assert.notEqual(result.data.id,fixture.id)
  assert.equal(types.isPrimordialServico(result.data),false)
})
test('custom tables remain deletable; missing services and client sessions cannot delete tables',async()=>{
  const h=harness()
  assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success,true)
  assert.ok(h.db.writes.some(w=>w.table==='servicos_linke'&&w.kind==='delete'))
  const missing=harness();assert.equal((await missing.actions.deleteServicoLinkeAction('missing')).success,false)
  assert.equal(missing.db.writes.length,0)
  const client=harness({role:'client'});await assert.rejects(client.actions.deleteServicoLinkeAction(fixture.id),/Unauthorized/)
  assert.equal(client.db.writes.length,0)
  await assert.rejects(client.actions.deleteServicoLinkeAction('srv_linke_dd_std'),/Unauthorized/)
  assert.equal(client.db.writes.length,0)
})
test('the catalogue renders delete controls for both base and custom tables',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const load=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react')})
  const {TabelasLinkeTab}=load('app/ops/configuracao/servicos/components/TabelasLinkeTab.tsx')
  const render=service=>renderToStaticMarkup(React.createElement(TabelasLinkeTab,{mode:'linke_services',servicos:[service]}))
  for(const service of [fixture,{...fixture,id:'srv_linke_dd_std',is_primordial:false},{...fixture,is_primordial:true}]){
    const markup=render(service)
    assert.match(markup,/title="Eliminar Tabela"/)
    assert.doesNotMatch(markup,/Protegida/)
  }
})
