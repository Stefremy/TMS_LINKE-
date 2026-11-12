const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')

const input={connection_id:'selected',carrier_code:'ctt_expresso',date:'2026-10-19',startHour:'09:00',endHour:'19:00',volumes:1,weightKg:1,sender:{name:'Store',address:'Street',zip:'4800-019',city:'Guimarães',phone:'910000001'}}
const config={carrier_code:'ctt_expresso',client_id:'client-selected',contract_number:'contract-selected',auth_id:'fixture-auth',environment:'production',is_active:true}

function setup(tables,denied=false,pickupResult={success:false,error:'MOCK_ONLY_NO_BOOKING'}){
  const db=fakeSupabase(tables),initialized=[],pickups=[],references=[],emails=[]
  const load=createLoader({
    '@/lib/config/public-origins':{publicUrl:path=>`https://portal.example.invalid${path}`},
    '@/lib/email/resend':{sendEmail:async value=>{emails.push(value);return{success:true,data:{id:'fixture-mail'}}},compileTemplate:(template,variables)=>JSON.stringify(variables)},
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/lib/auth/context':{requireEmployee:async()=>{if(denied)throw new Error('Forbidden');return {user:{id:'authenticated-user',email:'operator@example.test'},colaborador_id:'staff-profile'}},getTenantId:async()=>'own'},
    'next/cache':{revalidatePath(){}},
    '@/lib/services/tracking':{},
    '@/lib/services/carriers/ctt-provider':{CttProvider:class{async initialize(creds){initialized.push(creds)}async createPickup(value){pickups.push(value);return pickupResult}}},
    '@/lib/services/ctt':{CTTReferencesService:class{async getAllDeliveryPoints(creds){references.push(creds);return [{codigo:'fixture-point',nome:'Fixture CTT'}]}}},
    '@/lib/label-utils':{},
    '@/lib/services/ctt/close-manifest':{},
  })
  return {api:load('app/actions/ctt.ts'),db,initialized,pickups,references,emails}
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

test('accepted pickups record the authenticated login, never a claimed operator from the form or carrier contact',()=>withoutEnvironment(async()=>{
  const {api,db,pickups}=setup({carrier_connections:[{...config,id:'selected',tenant_id:'own'}]},false,{success:true,pickupNumber:'FIXTURE-ONLY'})
  const result=await api.scheduleCttPickupAction({...input,
    requested_by:{user_id:'forged-user',email:'forged@example.test'},
    requester:{name:'Carrier contact',phone:'253000000'},
  })
  assert.equal(result.success,true)
  assert.equal(pickups.length,1)
  const audit=db.writes.find(w=>w.table==='audit_log'&&w.value.action==='recolha_data').value
  assert.equal(audit.tenant_id,'own')
  assert.deepEqual(audit.details.requested_by,{user_id:'authenticated-user',email:'operator@example.test',colaborador_id:'staff-profile'})
  assert.equal(audit.details.requester.name,'Carrier contact')
  assert.ok(Number.isFinite(Date.parse(audit.details.requested_at)))
}))

test('client-request bookings defer their email to the completion flow; standalone Ops confirmations use notificacoes',()=>withoutEnvironment(async()=>{
  for(const linked of [true,false]) {
    const h=setup({carrier_connections:[{...config,id:'selected',tenant_id:'own'}]},false,{success:true,pickupNumber:'FIXTURE-ONLY'})
    const result=await h.api.scheduleCttPickupAction({...input,client_request_id:linked?'linked-request':undefined,sender:{...input.sender,email:'form@example.invalid'}})
    assert.equal(result.success,true)
    assert.equal(h.emails.length,linked?0:1)
    if(!linked)assert.equal(h.emails[0].from,'Linke <notificacoes@linke.pt>')
  }
}))

test('CTT points load from the latest company account when several connections exist and env credentials are absent',()=>withoutEnvironment(async()=>{
  const {api,references,db}=setup({carrier_connections:[
    {...config,id:'older',tenant_id:'own',client_id:'old-client',created_at:'2026-10-01'},
    {...config,id:'latest',tenant_id:'own',created_at:'2026-10-19'},
    {...config,id:'foreign',tenant_id:'foreign',created_at:'2099-01-01'},
  ]})
  const result=await api.getPontosPickupCttAction(true)
  assert.equal(result.success,true);assert.equal(result.total,1)
  assert.equal(references.length,1);assert.equal(references[0].client_number,'client-selected')
  assert.equal(references[0].environment,'production');assert.deepEqual(db.writes,[])
  assert.ok(db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value==='own')))
}))

test('CTT points resolve legacy saved credentials without requiring environment variables',()=>withoutEnvironment(async()=>{
  const {api,references}=setup({audit_log:[
    {id:'saved',tenant_id:'own',action:'carrier_connection_config',created_at:'2026-10-19',details:config},
    {id:'foreign',tenant_id:'foreign',action:'carrier_connection_config',created_at:'2099-01-01',details:{...config,client_id:'foreign-client'}},
  ]})
  assert.equal((await api.getPontosPickupCttAction(true)).success,true)
  assert.equal(references[0].client_number,'client-selected')
}))

test('CTT points accept the legacy ctt carrier code',()=>withoutEnvironment(async()=>{
  const {api,references}=setup({carrier_connections:[{...config,carrier_code:'ctt',tenant_id:'own'}]})
  assert.equal((await api.getPontosPickupCttAction(true)).success,true)
  assert.equal(references[0].client_number,'client-selected')
}))

test('CTT points reject missing, incomplete or disabled configuration before calling the carrier',()=>withoutEnvironment(async()=>{
  for(const connection of [null,{...config,auth_id:''},{...config,is_active:false}]){
    const {api,references}=setup({carrier_connections:connection?[{...connection,tenant_id:'own'}]:[]})
    const result=await api.getPontosPickupCttAction(true)
    assert.equal(result.success,false);assert.equal(result.total,0)
    assert.match(result.error,/credenciais completas|desativada/)
    assert.equal(references.length,0)
  }
}))

test('client accounts cannot load CTT points or resolve credentials through the employee action',async()=>{
  const {api,db,references}=setup({},true)
  await assert.rejects(()=>api.getPontosPickupCttAction(true),/Forbidden/)
  assert.equal(db.queries.length,0);assert.equal(references.length,0)
})
