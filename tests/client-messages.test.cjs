const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const T='11111111-1111-1111-1111-111111111111',A='22222222-2222-2222-2222-222222222222',B='33333333-3333-3333-3333-333333333333',U='44444444-4444-4444-8444-444444444444',M='55555555-5555-4555-8555-555555555555'
const client={user:{id:U},role:'client',tenant_id:T,client_id:A,permissions:[]},staff={...client,role:'employee',client_id:null,permissions:['Gestão de Clientes & Contratos']}
function harness(ctx=client,{failure,rpcError}={}){
 const db=fakeSupabase({clients:[{id:A,tenant_id:T},{id:B,tenant_id:T},{id:M,tenant_id:M}]},failure),calls=[]
 db.client.rpc=async(name,args)=>{calls.push({name,args});return{data:name==='send_client_message'?M:name==='client_message_page'?{messages:[{id:M,body:'Aviso da sua loja',title:'Aviso',kind:'info'}],unreadCount:1,next:null}:null,error:rpcError?{code:rpcError,message:'PRIVATE DATABASE ERROR'}:null}}
 const load=createLoader({'@/lib/auth/context':{getAuthContext:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>db.client}}),route=load('app/api/client-messages/route.ts')
 return{db,calls,load,async get(query='clientId='+A){return route.GET(new Request('https://toke.pt/api/client-messages?'+query))},async post(body,origin='https://toke.pt'){return route.POST(new Request('https://toke.pt/api/client-messages',{method:'POST',headers:origin?{origin}:{},body:JSON.stringify(body)}))}}
}
test('no login cannot read or mutate the inbox',async()=>{const h=harness(null);assert.equal((await h.get()).status,401);assert.equal((await h.post({action:'send'})).status,401);assert.equal(h.db.queries.length,0);assert.equal(h.calls.length,0)})
test('a client cannot list or mark another store even if it knows its UUID',async()=>{
 const h=harness();assert.equal((await h.get('clientId='+B)).status,403);assert.equal((await h.post({action:'read',clientId:B,ids:[M]})).status,403);assert.equal(h.calls.length,0)
})
test('both client and staff store lookups are tenant scoped; a foreign target fails before the RPC',async()=>{
 for(const ctx of [client,staff]){const h=harness(ctx);assert.equal((await h.get('clientId='+M)).status,403);assert.equal(h.calls.length,0)}
})
test('listing binds authenticated identity, preserves private cache headers and supports summary-only polling',async()=>{
 const h=harness();const response=await h.get('clientId='+A+'&summary=1');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/)
 assert.deepEqual(h.calls[0].args,{p_tenant:T,p_client:A,p_user:U,p_before:null,p_before_id:null,p_unread:false,p_limit:0,p_kind:null})
})
test('cursor pairs and category filters are validated before any message query',async()=>{
 for(const query of ['before=bad','before=2026-10-23T10:00:00Z&beforeId=bad','kind=private','beforeId='+M]){const h=harness();assert.equal((await h.get('clientId='+A+'&'+query)).status,400);assert.equal(h.calls.length,0)}
 const h=harness();await h.get('clientId='+A+'&kind=invoice&unread=1');assert.equal(h.calls[0].args.p_kind,'invoice');assert.equal(h.calls[0].args.p_unread,true)
})
test('read markers use the signed-in user and ignore caller-supplied identities',async()=>{
 const h=harness();assert.equal((await h.post({action:'read',clientId:A,ids:[M,M],userId:B,tenantId:M})).status,200)
 assert.deepEqual(h.calls[0],{name:'mark_client_messages_read',args:{p_tenant:T,p_client:A,p_user:U,p_ids:[M]}})
})
test('invalid and oversized read selections never call the mutation RPC',async()=>{
 for(const ids of [[],['wrong'],Array(51).fill(M),null]){const h=harness();assert.equal((await h.post({action:'read',clientId:A,ids})).status,400);assert.equal(h.calls.length,0)}
})
test('client and unprivileged staff cannot send system notices',async()=>{
 for(const ctx of [client,{...staff,permissions:[]}]){const h=harness(ctx);assert.equal((await h.post({action:'send',clientId:A,requestId:M,title:'Aviso',body:'Olá'})).status,403);assert.equal(h.calls.length,0)}
})
test('authorized staff sends plain text with a retry key into the chosen store only',async()=>{
 const h=harness(staff);const response=await h.post({action:'send',clientId:B,requestId:M,title:' Aviso ',body:' <script>unsafe()</script> ',tenant_id:M,user_id:B})
 assert.equal(response.status,200);assert.deepEqual(h.calls[0],{name:'send_client_message',args:{p_tenant:T,p_client:B,p_user:U,p_request:M,p_title:'Aviso',p_body:'<script>unsafe()</script>'}})
})
test('malformed manual content and request tokens are rejected without sending',async()=>{
 for(const patch of [{title:''},{body:' '},{title:'x'.repeat(161)},{body:'x'.repeat(4001)},{requestId:'bad'}]){const h=harness(staff);assert.equal((await h.post({action:'send',clientId:A,requestId:M,title:'Aviso',body:'Texto',...patch})).status,400);assert.equal(h.calls.length,0)}
})
test('cross-origin and unknown actions cannot mutate messages',async()=>{
 for(const origin of ['https://evil.invalid',null]){const h=harness(staff);assert.equal((await h.post({action:'send'},origin)).status,403);assert.equal(h.calls.length,0)}
 const h=harness();assert.equal((await h.post({action:'erase-all',clientId:A})).status,400)
})
test('a database read-marker failure never reports a successful read',async()=>{
 for(const rpcError of ['network','PGRST202']){const h=harness(client,{rpcError}),r=await h.post({action:'read',clientId:A,ids:[M]});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE DATABASE/)}
})
test('unknown database failures do not leak raw errors',async()=>{const h=harness(client,{rpcError:'XX000'}),r=await h.get();assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE DATABASE/)})
test('message action URLs stay inside the selected store and reject unknown targets',()=>{
 const pure=createLoader({})('lib/client-messages/types.ts');assert.equal(pure.messageLink('/app/stef-store','envios'),'/app/stef-store/envios');assert.equal(pure.messageLink('/app/stef-store','https://evil.invalid'),null)
})
test('inbox read failures keep the unread state; confirmed writes update it and the shared bell',async()=>{
 for(const success of [false,true]){
  const state=[],refs=[];let cursor=0,refCursor=0,refreshes=0
  const react={useState(initial){const id=cursor++;if(!(id in state))state[id]=initial;return[state[id],value=>{state[id]=typeof value==='function'?value(state[id]):value}]},useRef(initial){const id=refCursor++;return refs[id]||=( {current:initial})},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect(){}}
  const jsx=(type,props)=>({type,props:props||{}})
  const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,key)=>String(key)}),'next/link':{default:'link'},
   './ClientScope':{useClientScope:()=>({client:{id:A},basePath:'/app/stef-store',isEmployee:false})},'./ClientMessages':{useClientMessageCounter:()=>({refresh:async()=>{refreshes++}})},
   fetch:async()=>Response.json(success?{success:true}:{error:'Erro de leitura'},{status:success?200:503})})
  const Component=load('app/app/components/ClientInbox.tsx').ClientInbox
  const flatten=n=>Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
  const render=()=>{cursor=0;refCursor=0;return flatten(Component({initialMessages:[{id:M,kind:'info',title:'Aviso',body:'Texto',read_at:null,created_at:'2026-10-23T10:00:00Z',section:null,reference:null}],initialUnreadCount:1}))}
  const button=render().find(n=>n.type==='button'&&n.props.children==='Marcar como lida')
  button.props.onClick({stopPropagation(){}});await new Promise(resolve=>setImmediate(resolve))
  render();assert.equal(state[1],success?0:1);assert.equal(Boolean(state[0][0].read_at),success);assert.equal(refreshes,success?1:0)
 }
})
test('audit_log fallback delivers messages end-to-end when client_messages RPCs are missing (PGRST202)',async()=>{
 const tables={clients:[{id:A,tenant_id:T},{id:B,tenant_id:T}],audit_log:[]}
 const db=fakeSupabase(tables,null,{persistInserts:true})
 db.client.rpc=async()=>({data:null,error:{code:'PGRST202',message:'Could not find function in schema cache'}})
 let activeCtx={...staff,user:{id:U},permissions:['Pedidos de Recolha & Distribuição']}
 const load=createLoader({'@/lib/auth/context':{getAuthContext:async()=>activeCtx},'@/lib/supabase/server':{createAdminClient:()=>db.client}})
 const route=load('app/api/client-messages/route.ts')
 const post=(body)=>route.POST(new Request('https://toke.pt/api/client-messages',{method:'POST',headers:{origin:'https://toke.pt'},body:JSON.stringify(body)}))
 const get=(query)=>route.GET(new Request('https://toke.pt/api/client-messages?'+query))

 // 1. Staff sends notice to store A; idempotent retry returns same ID; mismatched payload with same requestId fails
 const sendRes=await post({action:'send',clientId:A,requestId:M,title:' Horário Recolhas ',body:' Amanhã às 16h30 '})
 assert.equal(sendRes.status,200)
 const sent=await sendRes.json()
 assert.match(sent.id,/^[a-f\d-]{36}$/i)
 const retrySame=await post({action:'send',clientId:A,requestId:M,title:'Horário Recolhas',body:'Amanhã às 16h30'})
 assert.equal(retrySame.status,200)
 assert.equal((await retrySame.json()).id,sent.id)
 const retryMismatch=await post({action:'send',clientId:A,requestId:M,title:'Outro título',body:'Amanhã às 16h30'})
 assert.equal(retryMismatch.status,503)

 // 2. Store B sees 0 messages; Store A client sees 1 unread message in summary, unread filter, and inbox
 activeCtx={...client,client_id:B}
 const pageB=await (await get('clientId='+B)).json()
 assert.equal(pageB.unreadCount,0);assert.equal(pageB.messages.length,0)

 activeCtx=client
 const summaryA=await (await get('clientId='+A+'&summary=1')).json()
 assert.equal(summaryA.unreadCount,1);assert.equal(summaryA.messages.length,0)
 const inboxA=await (await get('clientId='+A+'&unread=1')).json()
 assert.equal(inboxA.unreadCount,1);assert.equal(inboxA.messages.length,1)
 assert.equal(inboxA.messages[0].title,'Horário Recolhas')
 assert.equal(inboxA.messages[0].body,'Amanhã às 16h30')
 assert.equal(inboxA.messages[0].read_at,null)

 // 3. Staff marking read only marks for staff user, NOT for client user
 activeCtx={...staff,user:{id:'99999999-9999-4999-8999-999999999999'}}
 assert.equal((await post({action:'read',clientId:A,ids:[sent.id]})).status,200)
 activeCtx=client
 assert.equal((await (await get('clientId='+A+'&summary=1')).json()).unreadCount,1)

 // 4. Client marking read updates unreadCount to 0 and populates read_at
 assert.equal((await post({action:'read',clientId:A,ids:[sent.id]})).status,200)
 const afterRead=await (await get('clientId='+A)).json()
 assert.equal(afterRead.unreadCount,0)
 assert.equal(afterRead.messages.length,1)
 assert.ok(afterRead.messages[0].read_at)
 assert.equal((await (await get('clientId='+A+'&unread=1')).json()).messages.length,0)
})
