const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const TENANT = '11111111-1111-1111-1111-111111111111'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OTHER = '99999999-9999-4999-8999-999999999999'
const decision = (id,blocked,created_at='2026-10-22T12:00:00Z',tenant_id=TENANT) => ({id:created_at,tenant_id,action:'client_portal_access',created_at,details:{id,blocked}})
function harness({role='client',logs=[],failure}={}) {
  const tables = {audit_log:logs,clients:[{id:A,tenant_id:TENANT},{id:B,tenant_id:OTHER}],colaboradores:[],client_users:[]}
  const db = fakeSupabase(tables,failure)
  const user = {id:'user-test',email:'test@example.invalid',app_metadata:{role,tenant_id:TENANT,client_id:A}}
  const load = createLoader({
    '@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user}})}})},
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/app/ops/entidades/colaboradores/types':{DEFAULT_COLABORADORES:[]},
    react:{cache:fn=>fn},
    'next/headers':{cookies:async()=>({getAll:()=>[],get:()=>null})},
    'next/navigation':{redirect:url=>{throw new Error(`REDIRECT:${url}`)}},
    'next/cache':{revalidatePath(){}},
  })
  return {db,tables,auth:load('lib/auth/context.ts'),actions:load('app/actions/client-portal-access.ts')}
}

test('a suspended existing client session is rejected by the common auth context, not merely by the UI',async()=>{
  const h=harness({logs:[decision(A,true)]})
  await assert.rejects(h.auth.getAuthContext(),/REDIRECT:\/conta-suspensa/)
  await assert.rejects(h.auth.requireClientAccess(A),/REDIRECT:\/conta-suspensa/)
  assert.equal(h.db.writes.length,0)
})
test('decisions are scoped to the authenticated tenant and store; another store or tenant cannot suspend this session',async()=>{
  const h=harness({logs:[decision(B,true),decision(A,true,undefined,OTHER)]})
  assert.equal((await h.auth.requireUser()).client_id,A)
  for(const q of h.db.queries.filter(q=>q.table==='audit_log')) {
    assert.ok(q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
    assert.ok(q.filters.some(f=>f.field==='details->>id'&&f.value===A))
  }
})
test('reactivation takes effect on the next request and old blocking decisions cannot override it',async()=>{
  const h=harness({logs:[decision(A,true)]})
  await assert.rejects(h.auth.requireUser(),/conta-suspensa/)
  h.tables.audit_log.push(decision(A,false,'2026-10-22T13:00:00Z'))
  assert.equal((await h.auth.requireUser()).client_id,A)
  h.tables.audit_log.push(decision(A,true,'2026-10-22T14:00:00Z'))
  await assert.rejects(h.auth.requireUser(),/conta-suspensa/)
})
test('an unavailable access check fails closed instead of authorizing a potentially blocked client',async()=>{
  const h=harness({failure:q=>q.table==='audit_log'?{message:'database unavailable'}:null})
  await assert.rejects(h.auth.getAuthContext(),/Não foi possível verificar o acesso/)
})
test('staff keep their operations access; only administrators may change a client suspension',async()=>{
  for(const role of ['employee','admin']) {
    const h=harness({role,logs:[decision(A,true)]})
    assert.equal((await h.auth.requireEmployee()).role,role)
    assert.equal(h.db.queries.some(q=>q.table==='audit_log'),false)
  }
  for(const role of ['client','employee']) {
    const h=harness({role})
    await assert.rejects(h.actions.setClientPortalBlockedAction(A,true),/Acesso restrito/)
    assert.equal(h.db.writes.length,0)
  }
})
test('admin block/reactivate records are tenant-scoped and attributed without changing commercial profiles or financial data',async()=>{
  const h=harness({role:'admin'})
  for(const blocked of [true,false]) {
    assert.deepEqual(await h.actions.setClientPortalBlockedAction(A,blocked),{blocked})
    const write=h.db.writes.at(-1)
    assert.equal(write.table,'audit_log');assert.equal(write.value.action,'client_portal_access')
    assert.equal(write.value.tenant_id,TENANT)
    assert.deepEqual(write.value.details,{id:A,blocked,changed_by:'user-test'})
  }
  await assert.rejects(h.actions.setClientPortalBlockedAction(B,true),/nesta empresa/)
  await assert.rejects(h.actions.setClientPortalBlockedAction(A,'true'),/Estado de acesso inválido/)
  assert.equal(h.db.writes.length,2)
})
test('failed persistence is reported instead of showing a successful block',async()=>{
  const h=harness({role:'admin',failure:q=>q.write?{message:'write failed'}:null})
  await assert.rejects(h.actions.setClientPortalBlockedAction(A,true),/Não foi possível alterar/)
})

test('the modal requires confirmation, disables the action while saving and then offers reactivation',async()=>{
  const slots=[],effects=[],calls=[]
  let cursor=0,finish
  const jsx=(type,props)=>({type,props:props||{}})
  const load=createLoader({
    react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useEffect(fn){effects.push(fn)}},
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'lucide-react':new Proxy({},{get:(_,name)=>name}),
    '@/app/actions/client-portal-access':{
      getClientPortalAccessAction:async()=>({blocked:false}),
      setClientPortalBlockedAction:(id,blocked)=>{calls.push({id,blocked});return new Promise(resolve=>{finish=resolve})},
    },
  })
  const Control=load('app/ops/entidades/clientes/components/ClientPortalAccessControl.tsx').ClientPortalAccessControl
  function expand(node){
    if(Array.isArray(node))return node.map(expand)
    if(!node||typeof node!=='object')return node
    if(typeof node.type==='function')return expand(node.type(node.props))
    return {...node,props:{...node.props,children:expand(node.props.children)}}
  }
  const render=()=>{cursor=0;return expand(jsx(Control,{clientId:A}))}
  const flat=node=>Array.isArray(node)?node.flatMap(flat):node&&typeof node==='object'?[node,...flat(node.props.children)]:[]
  const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props.children):String(node??'')
  const button=()=>flat(render()).find(node=>node.type==='button'&&/Bloquer|Bloquear|Confirmar|Reativar|A atualizar/.test(text(node)))
  render();effects.shift()();await new Promise(resolve=>setImmediate(resolve))
  assert.match(text(button()),/Bloquear Cliente/)
  await button().props.onClick()
  assert.equal(calls.length,0);assert.match(text(button()),/Confirmar bloqueio/)
  const saving=button().props.onClick()
  assert.equal(button().props.disabled,true)
  assert.match(text(button()),/A atualizar/)
  assert.deepEqual(calls,[{id:A,blocked:true}])
  finish({blocked:true});await saving
  assert.equal(button().props.disabled,false);assert.match(text(button()),/Reativar Cliente/)
  const restoring=button().props.onClick();finish({blocked:false});await restoring
  assert.deepEqual(calls.at(-1),{id:A,blocked:false})
  assert.match(text(button()),/Bloquear Cliente/)
})
