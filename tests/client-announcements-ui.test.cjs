const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const A='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',M='55555555-5555-4555-8555-555555555555'
const notice={id:M,title:'Aviso',body:'Atrasos nas ilhas',target:'all',clientId:null,active:true,level:'warning',expiresAt:null,createdAt:new Date().toISOString()}
const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function hooks(t){
 const slots=[],effects=[],cleanup=[];let cursor=0
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial}},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,n)=>!Object.is(v,slots[i].deps[n])))slots[i]={fn,deps};return slots[i].fn},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,n)=>!Object.is(v,slots[i][n]))){slots[i]=deps;effects.push(()=>{cleanup[i]?.();cleanup[i]=fn()})}},
 }
 t.after(()=>cleanup.forEach(fn=>fn?.()))
 return{react,render(fn){cursor=0;const nodes=flat(fn());effects.splice(0).forEach(fn=>fn());return nodes}}
}
const jsx=(type,props)=>({type,props:props||{}})
test('portal ticker displays all-account notices, supports pausing, and rejects stale responses after a store switch',async t=>{
 const h=hooks(t),oldDocument=global.document,listeners=new Map()
 global.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}
 t.after(()=>{global.document=oldDocument})
 let scope={client:{id:A}}
 const requests=[]
 const load=createLoader({react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  './ClientScope':{useClientScope:()=>scope},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))})
 const {ClientAnnouncements}=load('app/app/components/ClientAnnouncements.tsx')
 const render=()=>h.render(()=>ClientAnnouncements())
 assert.deepEqual(render(),[])
 requests[0].resolve({ok:true,json:async()=>({notices:[notice,{...notice,id:B,target:'client',clientId:B,title:'PRIVATE B'}]})});await flush()
 let nodes=render();assert.ok(nodes.some(n=>n.props.role==='status'&&text(n).includes('Atrasos nas ilhas')))
 assert.ok(!nodes.some(n=>text(n).includes('PRIVATE B')))
 nodes.find(n=>n.type==='button').props.onClick();nodes=render()
 assert.equal(nodes.find(n=>n.props['data-paused']!==undefined).props['data-paused'],true)
 listeners.get('visibilitychange')();assert.equal(requests.length,2)
 scope={client:{id:B}};render()
 assert.equal(requests[1].options.signal.aborted,true)
 requests[1].resolve({ok:true,json:async()=>({notices:[{...notice,target:'client',clientId:A,title:'PRIVATE A'}]})})
 requests[2].resolve({ok:true,json:async()=>({notices:[]})});await flush()
 assert.deepEqual(render(),[])
})
test('publisher defaults to every account, preserves a retry token after failure and prevents duplicate clicks',async t=>{
 const h=hooks(t),posts=[]
 let complete
 const load=createLoader({react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),fetch:async(url,options)=>{
  if(options?.method==='POST'){posts.push(JSON.parse(options.body));return new Promise(resolve=>{complete=resolve})}
  return{ok:true,json:async()=>({notices:[]})}
 }})
 const {AnnouncementsComposer}=load('app/ops/mensagens/AnnouncementsComposer.tsx')
 const render=()=>h.render(()=>AnnouncementsComposer({clients:[{id:A,name:'Loja A'}]}))
 let nodes=render()
 assert.equal(nodes.find(n=>n.props['aria-label']==='Destinatários do comunicado').props.value,'all')
 nodes.find(n=>n.type==='input'&&n.props.maxLength===160).props.onChange({target:{value:'Aviso geral'}})
 nodes.find(n=>n.type==='textarea').props.onChange({target:{value:'Texto do comunicado'}});nodes=render()
 const submit=nodes.find(n=>n.type==='form').props.onSubmit
 const first=submit({preventDefault(){}});await submit({preventDefault(){}})
 assert.equal(posts.length,1);assert.equal(posts[0].target,'all')
 complete({ok:false,json:async()=>({error:'Resposta perdida'})});await first;nodes=render()
 assert.equal(nodes.find(n=>n.type==='textarea').props.value,'Texto do comunicado')
 const retry=nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.equal(posts.length,2);assert.equal(posts[1].requestId,posts[0].requestId)
 complete({ok:true,json:async()=>({notice})});await retry;nodes=render()
 assert.ok(nodes.some(n=>n.props.role==='status'&&text(n).includes('todas as contas')))
 assert.equal(nodes.find(n=>n.type==='textarea').props.value,'')
})
test('announcement text renders as escaped text rather than executable markup',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const unsafe={...notice,title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>'}
 const load=createLoader({react:{...React,useState:initial=>React.useState(Array.isArray(initial)?[unsafe]:initial)},'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),'./ClientScope':{useClientScope:()=>({client:{id:A}})}})
 const {ClientAnnouncements}=load('app/app/components/ClientAnnouncements.tsx')
 const html=renderToStaticMarkup(React.createElement(ClientAnnouncements))
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img src=x/)
})
