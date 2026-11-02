const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {fakeSupabase} = require('./helpers/fake-supabase.cjs')
const policy = createLoader({})('lib/auth/permissions.ts')
const {PERMISSIONS: P} = policy
const TENANT = '11111111-1111-1111-1111-111111111111'
const admin = {id:'admin-user',email:'manager@example.invalid',app_metadata:{role:'admin',colaborador_id:'manager',tenant_id:TENANT}}
const employee = {id:'staff-user',email:'staff@example.invalid',app_metadata:{role:'employee',colaborador_id:'staff',tenant_id:TENANT,permissions:[P.shipments,P.pickups]}}
const profile = {id:'staff',code:'COL-STAFF',name:'Staff',email:employee.email,role:'Operations',department:'Operações & Logística',status:'Ativo',access_level:'Operacional',permissions:[P.shipments,P.pickups],created_at:'2026-10-01'}

function harness({user=admin,users=[admin,employee],rows=[],events=[],failure,failAuth=false}={}) {
 const tables={colaboradores:rows,audit_log:events,client_users:[]}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const authCalls=[]
 const accountUsers=structuredClone(users)
 db.client.auth={admin:{
  async listUsers(){authCalls.push('list');return {data:{users:accountUsers},error:null}},
  async updateUserById(id,values){authCalls.push({id,values});if(failAuth)return {error:{message:'fixture failure'}};Object.assign(accountUsers.find(u=>u.id===id),values);return {error:null}},
  async createUser(values){authCalls.push({create:values});accountUsers.push({id:'created-user',...values});return {error:null}},
 }}
 const load=createLoader({
  '@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user},error:null})}})},
  '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
  'next/headers':{cookies:async()=>({getAll:()=>[],get:()=>null})},
  'next/navigation':{redirect:url=>{throw new Error(`REDIRECT:${url}`)}},
  'next/cache':{revalidatePath(){}},react:{cache:fn=>fn},
 })
 return {load,db,tables,accountUsers,authCalls,auth:load('lib/auth/context.ts'),actions:load('app/actions/colaboradores.ts')}
}
const saved = (details,at='2026-11-01',tenant=TENANT) => ({tenant_id:tenant,action:'colaborador_updated',details,created_at:at})

test('permissions include support, client access email, reports and documents; legacy operational labels normalize safely',()=>{
 assert.ok(policy.AVAILABLE_STAFF_PERMISSIONS.includes(P.support))
 assert.ok(policy.AVAILABLE_STAFF_PERMISSIONS.includes(P.accessEmail))
 assert.deepEqual(policy.parsePermissions('["Acesso Operacional","Acesso Operacional"]'),[P.shipments,P.pickups])
 assert.deepEqual(policy.parsePermissions('malformed'),[])
 assert.deepEqual(policy.validateStaffAccess('Operacional',[]),[])
 assert.throws(()=>policy.validateStaffAccess('Operacional',[P.all]),/Administrador/)
 assert.throws(()=>policy.validateStaffAccess('invalid',[]),/perfil/)
 assert.throws(()=>policy.validateStaffAccess('Operacional',['unknown']),/desconhecidas/)
 assert.equal(policy.validateStaffAccess('Administrador',[]).length,policy.AVAILABLE_STAFF_PERMISSIONS.length)
})

test('route grants distinguish creating shipments, support, pickups, finance, salaries and administration',()=>{
 const ctx=permissions=>({role:'employee',permissions})
 assert.equal(policy.canAccessOpsRoute(ctx([P.support]),'/ops/tracking'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.support]),'/ops/envios/novo'),false)
 assert.equal(policy.canAccessOpsRoute(ctx([P.pickups]),'/ops/envios/recolhas'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.shipments]),'/ops/envios/recolhas'),false)
 assert.equal(policy.canAccessOpsRoute(ctx([P.finance]),'/ops/faturacao/clientes'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.finance]),'/ops/tesouraria/salarios'),false)
 assert.equal(policy.canAccessOpsRoute(ctx([P.salaries]),'/ops/tesouraria/salarios'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.integrations]),'/ops/configuracao/webservices'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.integrations]),'/ops/configuracao/geral'),false)
 assert.equal(policy.canAccessOpsRoute(ctx([P.accessEmail]),'/ops/entidades/clientes'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.accessEmail]),'/ops/clientes/novo'),false)
 assert.equal(policy.canAccessOpsRoute({...ctx([]),user:{email:'aldara.linke@gmail.com'}},'/ops/entidades/clientes'),true)
 assert.equal(policy.canAccessOpsRoute(ctx([P.all]),'/ops/entidades/colaboradores'),false)
 assert.equal(policy.canAccessOpsRoute({role:'client',permissions:[P.all]},'/ops'),false)
 assert.equal(policy.canAccessOpsRoute(ctx([]),'/ops/future-module'),false)
 for(const route of ['/ops','/ops/perfil','/ops/chat','/ops/calendario'])assert.equal(policy.canAccessOpsRoute(ctx([]),route),true)
})

test('every OPS page checks its actual route before loading page data and has an explicit access rule',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)])
 for(const file of walk('app/ops').filter(file=>file.endsWith('/page.tsx'))){
  const route='/'+file.replace(/^app\//,'').replace(/\/page.tsx$/,'')
  assert.ok(fs.readFileSync(file,'utf8').includes(`await requireOpsPageAccess("${route}")`),file)
  assert.ok(route==='/ops'||policy.OPS_ACCESS_RULES.some(rule=>route===rule.path||route.startsWith(rule.path+'/')),route)
 }
})

test('current session and directory use the latest scoped audit access instead of stale table or token permissions',async()=>{
 const user={...employee,app_metadata:{...employee.app_metadata,permissions:[P.finance]}}
 const h=harness({user,rows:[{...profile,tenant_id:TENANT,updated_at:'2026-10-01'}],events:[
  saved({...profile,permissions:[P.support]},'2026-11-01'),
  saved({...profile,permissions:[P.all],access_level:'Administrador'},'2099-01-01','foreign'),
 ]})
 const ctx=await h.auth.requireEmployee()
 assert.deepEqual(ctx.permissions,[P.support]);assert.equal(ctx.role,'employee')
 await assert.rejects(h.auth.requireEmployee(P.finance),/Acesso negado/)
 assert.equal((await h.auth.requireEmployee([P.shipments,P.support])).colaborador_id,'staff')
 const directory=await h.load('lib/auth/staff-directory.ts').loadStaffDirectory(h.db.client,TENANT,[user])
 assert.deepEqual(directory.find(c=>c.id==='staff').permissions,ctx.permissions)
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)))
})

test('inactive and deleted staff cannot regain access from an old valid auth token',async()=>{
 for(const events of [[saved({...profile,status:'Inativo'})],[saved(profile),{tenant_id:TENANT,action:'colaborador_deleted',details:{id:'staff'},created_at:'2026-11-02'}]]){
  const h=harness({user:employee,events})
  await assert.rejects(h.auth.requireEmployee(),/REDIRECT:\/login/)
 }
 const legacyUser={...employee,id:'12345678-legacy-user',app_metadata:{role:'employee',tenant_id:TENANT}}
 const legacy=harness({user:legacyUser,events:[{tenant_id:TENANT,action:'colaborador_deleted',details:{id:'col-12345678'},created_at:'2026-11-02'}]})
 await assert.rejects(legacy.auth.requireEmployee(),/REDIRECT:\/login/)
})

test('self-editable user metadata and a name containing stefano do not grant staff access',async()=>{
 const user={id:'unassigned',email:'stefano-copy@example.invalid',app_metadata:{},user_metadata:{role:'admin',permissions:[P.all]}}
 await assert.rejects(harness({user,users:[user]}).auth.requireEmployee(),/REDIRECT:\/login/)
})

test('ordinary profile edits preserve permissions and synchronize the trusted auth metadata',async()=>{
 const h=harness({events:[saved(profile)]})
 const res=await h.actions.saveColaboradorAction({id:'staff',name:'Updated Staff',role:profile.role,department:profile.department,email:profile.email})
 assert.deepEqual(res.colaborador.permissions,profile.permissions)
 assert.equal(res.colaborador.access_level,'Operacional')
 const write=h.db.writes.find(w=>w.kind==='insert')
 assert.deepEqual(write.value.details.permissions,profile.permissions)
 assert.equal(write.value.tenant_id,TENANT)
 assert.deepEqual(h.accountUsers.find(u=>u.id==='staff-user').app_metadata.permissions,profile.permissions)
 assert.equal(h.accountUsers.find(u=>u.id==='staff-user').app_metadata.tenant_id,TENANT)
})

test('ordinary employees cannot change permissions, status, credentials or delete staff',async()=>{
 const h=harness({user:employee,events:[saved(profile)]})
 for(const invoke of [()=>h.actions.saveColaboradorAction(profile),()=>h.actions.toggleColaboradorStatusAction('staff','Inativo'),()=>h.actions.deleteColaboradorAction('staff'),()=>h.load('app/actions/auth.ts').setColaboradorCredentialsAction('staff',profile.email,undefined,'Administrador',[P.all])]){
  await assert.rejects(invoke,/Acesso restrito/)
 }
 assert.deepEqual(h.db.writes,[]);assert.deepEqual(h.authCalls,[])
})

test('any verified administrator can save module access without a name-based exception',async()=>{
 const h=harness({events:[saved(profile)]})
 const res=await h.load('app/actions/auth.ts').setColaboradorCredentialsAction('staff',profile.email,undefined,'Comercial / Suporte',[P.clients,P.support])
 assert.equal(res.success,true)
 assert.deepEqual(res.colaborador.permissions,[P.clients,P.support])
 assert.equal(h.accountUsers.find(u=>u.id==='staff-user').app_metadata.role,'employee')
})

test('staff management refuses self lockout, foreign records, client account takeover and unknown grants before writes',async()=>{
 for(const run of [
  h=>h.actions.saveColaboradorAction({id:'manager',name:'Manager',role:'Admin',department:'Management',email:admin.email,access_level:'Operacional',permissions:[]}),
  h=>h.actions.saveColaboradorAction({...profile,id:'foreign'}),
  h=>h.actions.saveColaboradorAction({...profile,permissions:['unknown']}),
  h=>h.actions.saveColaboradorAction({...profile,email:'customer@example.invalid'}),
 ]){
  const h=harness({users:[admin,employee,{id:'customer',email:'customer@example.invalid',app_metadata:{role:'client'}}],events:[saved(profile)]})
  await assert.rejects(()=>run(h));assert.deepEqual(h.db.writes,[])
 }
})

test('failed audit persistence never reports a successful access change',async()=>{
 const h=harness({events:[saved(profile)],failure:q=>q.write?.kind==='insert'?{message:'private DB error'}:null})
 await assert.rejects(h.actions.saveColaboradorAction(profile),/Não foi possível guardar/)
 assert.equal(h.authCalls.filter(c=>typeof c==='object').length,0)
})

test('page access guard rejects direct finance navigation for an operations account',async()=>{
 const h=harness({user:employee})
 const guard=h.load('lib/auth/ops-page-access.ts')
 await assert.rejects(guard.requireOpsPageAccess('/ops/faturacao/clientes'),/REDIRECT:\/ops\/sem-acesso/)
 assert.equal((await guard.requireOpsPageAccess('/ops/envios/novo')).role,'employee')
})

test('permission editor renders every module and supports applying suggestions explicitly',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const load=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime')})
 const {StaffPermissionEditor}=load('app/ops/entidades/colaboradores/components/StaffPermissionEditor.tsx')
 const props={level:'Operacional',permissions:[P.shipments],onChange(){}}
 const html=renderToStaticMarkup(React.createElement(StaffPermissionEditor,props))
 for(const group of policy.PERMISSION_GROUPS)for(const item of group.items)assert.ok(html.includes(item.title),item.title)
 assert.ok(html.includes('Sugestões por função'))
 const adminHtml=renderToStaticMarkup(React.createElement(StaffPermissionEditor,{...props,level:'Administrador'}))
 assert.equal((adminHtml.match(/type="checkbox"/g)||[]).length,(adminHtml.match(/disabled=""/g)||[]).length)
 let changed
 const tree=StaffPermissionEditor({...props,onChange:(...values)=>changed=values})
 function buttons(node){return !node||typeof node!=='object'?[]:[...(node.type==='button'?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(buttons)]}
 buttons(tree).find(b=>React.Children.toArray(b.props.children).some(child=>child?.props?.children==='Financeiro')).props.onClick()
 assert.deepEqual(changed,['Operacional',[P.finance,P.reports]])
})

test('desktop and collapsed navigation only expose granted modules and link groups to an accessible child',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const load=createLoader({
  react:{...React,useState:initial=>React.useState(typeof initial==='object'?{'Entidades':true,'Faturação':true,'Tesouraria':true,'Configurações':true}:initial)},'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
  'next/navigation':{usePathname:()=>'/ops'},
  'next/link':{__esModule:true,default:({href,children})=>React.createElement('a',{href},children)},
 })
 const {SidebarNav}=load('app/ops/components/SidebarNav.tsx')
 for(const collapsed of [false,true]){
  const html=renderToStaticMarkup(React.createElement(SidebarNav,{collapsed,access:{role:'employee',permissions:[P.finance]},canAccessDocuments:false,canSendMessages:false}))
  assert.match(html,/href="\/ops\/faturacao\/contas-corrente"/)
  assert.doesNotMatch(html,/href="\/ops\/envios|href="\/ops\/entidades\/colaboradores|href="\/ops\/configuracao\/webservices/)
 }
})

test('module server actions deny an ungranted operation before making business writes',async()=>{
 const h=harness({user:employee})
 await assert.rejects(h.load('app/actions/clientes.ts').saveClienteAction({id:'customer',short_name:'Customer'}),/Permissão necessária: Gestão de Clientes/)
 assert.deepEqual(h.db.writes,[])
 assert.equal(h.db.queries.some(q=>q.table==='clients'),false)
})

test('access changes after the first 1000 audit events still take effect',async()=>{
 const events=Array.from({length:1001},(_,i)=>({...saved({...profile,permissions:i===1000?[P.support]:[P.shipments]},new Date(Date.UTC(2026,9,1,0,0,i)).toISOString()),id:`event-${i}`}))
 const h=harness({user:employee,events})
 assert.deepEqual((await h.auth.requireEmployee()).permissions,[P.support])
 assert.ok(h.db.queries.some(q=>q.table==='audit_log'&&q.range?.[0]===1000))
})
