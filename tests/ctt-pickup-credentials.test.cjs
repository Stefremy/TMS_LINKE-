const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')

const input={connection_id:'selected',carrier_code:'ctt_expresso',date:'2026-10-19',startHour:'09:00',endHour:'19:00',volumes:1,weightKg:1,sender:{name:'Store',address:'Street',zip:'4800-019',city:'Guimarães',phone:'910000001'}}
const config={carrier_code:'ctt_expresso',client_id:'client-selected',contract_number:'contract-selected',auth_id:'fixture-auth',environment:'production',is_active:true}

function setup(tables,denied=false){
  const db=fakeSupabase(tables),initialized=[],pickups=[]
  const load=createLoader({
    '@/lib/config/public-origins':{},
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/lib/auth/context':{requireEmployee:async()=>{if(denied)throw new Error('Forbidden')},getTenantId:async()=>'own'},
    'next/cache':{revalidatePath(){}},
    '@/lib/services/tracking':{},
    '@/lib/services/carriers/ctt-provider':{CttProvider:class{async initialize(creds){initialized.push(creds)}async createPickup(value){pickups.push(value);return {success:false,error:'MOCK_ONLY_NO_BOOKING'}}}},
    '@/lib/services/ctt':{},
    '@/lib/label-utils':{},
    '@/lib/services/ctt/close-manifest':{},
  })
  return {api:load('app/actions/ctt.ts'),db,initialized,pickups}
}

async function withoutEnvironment(run){
  const keys=['CTT_CLIENT_ID','CTT_CONTRACT_ID','CTT_AUTHENTICATION_ID']
  const saved=keys.map(key=>process.env[key]);keys.forEach(key=>delete process.env[key])
  try{await run()}finally{keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i]})}
}

test('pickup uses the selected saved CTT account among several accounts without environment credentials',()=>withoutEnvironment(async()=>{
  const {api,initialized,pickups,db}=setup({carrier_connections:[{...config,id:'other',tenant_id:'own',client_id:'other-client'},{...config,id:'selected',tenant_id:'own'}]})
  const result=await api.scheduleCttPickupAction(input)
  assert.equal(result.error,'MOCK_ONLY_NO_BOOKING');assert.equal(initialized[0].client_number,'client-selected');assert.equal(pickups.length,1);assert.deepEqual(db.writes,[])
  assert.ok(db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value==='own')))
}))

test('pickup resolves legacy saved configuration shown by the account dropdown, without env vars',()=>withoutEnvironment(async()=>{
  const {api,initialized,db}=setup({carrier_connections:[],audit_log:[
    {id:'selected',tenant_id:'own',action:'carrier_connection_config',created_at:'2026-10-19',details:config},
    {id:'foreign',tenant_id:'foreign',action:'carrier_connection_config',created_at:'2099-01-01',details:{...config,client_id:'foreign-client'}},
  ]})
  assert.equal((await api.scheduleCttPickupAction(input)).error,'MOCK_ONLY_NO_BOOKING')
  assert.equal(initialized[0].client_number,'client-selected');assert.deepEqual(db.writes,[])
}))

test('incomplete or disabled CTT accounts stop before provider initialization and database writes',()=>withoutEnvironment(async()=>{
  for(const details of [{...config,auth_id:''},{...config,is_active:false}]){
    const {api,initialized,pickups,db}=setup({audit_log:[{id:'selected',tenant_id:'own',action:'carrier_connection_config',details}]})
    const result=await api.scheduleCttPickupAction(input)
    assert.equal(result.success,false);assert.match(result.error,/credenciais completas|desativada/)
    assert.equal(initialized.length,0);assert.equal(pickups.length,0);assert.deepEqual(db.writes,[])
  }
}))

test('default UI account identifier resolves the company configuration rather than a database ID',()=>withoutEnvironment(async()=>{
  const {api,initialized}=setup({carrier_connections:[{...config,id:'real-connection',tenant_id:'own'}]})
  assert.equal((await api.scheduleCttPickupAction({...input,connection_id:'default-ctt'})).error,'MOCK_ONLY_NO_BOOKING')
  assert.equal(initialized[0].client_number,'client-selected')
}))

test('client accounts cannot resolve credentials or schedule a pickup through the employee action',async()=>{
  const {api,db,initialized}=setup({},true)
  await assert.rejects(()=>api.scheduleCttPickupAction(input),/Forbidden/)
  assert.equal(db.queries.length,0);assert.equal(initialized.length,0)
})
