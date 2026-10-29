const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {EMPTY_SHIPMENT_FILTERS:empty}=createLoader({})('lib/services/shipments/shipment-list-filters.ts')
const flatten=n=>Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
function harness(t){
 const slots=[],deps=[],effects=[],cleanups=[];let cursor=0
 const oldWindow=global.window;global.window={location:{search:'?service=DD&context=islands&page=3'},addEventListener(){},removeEventListener(){}}
 t.after(()=>{cleanups.forEach(fn=>fn?.());global.window=oldWindow})
 const routes=[]
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useMemo:fn=>fn(),useEffect(fn,values){const i=cursor++;if(!deps[i]||values.some((v,n)=>!Object.is(v,deps[i][n]))){deps[i]=values;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}}
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/navigation':{useRouter:()=>({push:(url)=>routes.push(url),refresh(){}})},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/lib/hooks/useTrackingPolling':{useTrackingPolling(){}},'@/components/shipments/ShipmentParcelWeight':{},'@/components/ui/refresh-icon':{},'./ActionMenu':{},'./FerramentasMenu':{},'./NovaRecolhaModal':{},'./ManifestModal':{},'./ShipmentLateralDrawer':{},'@/app/app/components/ClientShipmentDetailModal':{},'@/lib/carrier-logos':{},'@/app/actions/ctt':{},'@/app/actions/shipments':{},'@/components/ui/button':{Button:'button'},'@/components/ui/badge':{}})
 const {EnviosClient}=load('app/ops/envios/components/EnviosClient.tsx')
 const props={envios:[],recolhas:[],clients:[],pagination:{page:3,totalPages:5,total:250},initialSearch:'CE',initialStatus:'Entregue',initialFilters:{...empty,service:'DD',context:'islands'},filterFacets:{services:['DD','DB fora da página'],carriers:[{value:'ctt',label:'CTT Expresso'},{value:'correos',label:'Correos Express'}],drivers:[{value:'d1',label:'João'}]}}
 const render=()=>{cursor=0;const nodes=flatten(EnviosClient(props));effects.splice(0).forEach(fn=>fn());return nodes}
 const button=(nodes,label)=>nodes.find(n=>n.type==='button'&&text(n).trim()===label)
 let nodes=render();button(nodes,'Filtrar').props.onClick();render()
 return{routes,render,button,props}
}
test('all real filter controls update their values and apply one global query preserving search and status',t=>{
 const h=harness(t);let nodes=h.render()
 const set=(label,value)=>{nodes.find(n=>n.props['aria-label']===label).props.onChange({target:{value}});nodes=h.render()}
 assert.equal(nodes.find(n=>n.props['aria-label']==='Data inicial').props.type,'date')
 assert.ok(nodes.some(n=>n.type==='option'&&n.props.value==='DB fora da página'))
 set('Filtrar Data','created');set('Data inicial','2026-10-01');set('Data final','2026-10-29');set('Serviço','DB fora da página');set('Fornecedor','correos');set('Condição do fornecedor','neq');set('Contexto','international');set('Tipo','return');set('Motorista','d1')
 h.button(nodes,'Aplicar filtros').props.onClick()
 const params=new URLSearchParams(h.routes.at(-1).split('?')[1])
 for(const [key,value] of Object.entries({dateField:'created',dateFrom:'2026-10-01',dateTo:'2026-10-29',service:'DB fora da página',carrier:'correos',carrierOp:'neq',context:'international',type:'return',driver:'d1',search:'CE',status:'Entregue'}))assert.equal(params.get(key),value,key)
 assert.equal(params.has('page'),false)
})
test('invalid date ranges block application; clear resets all fields, and page navigation keeps the applied query',t=>{
 const h=harness(t);let nodes=h.render()
 h.button(nodes,'Próxima').props.onClick()
 let params=new URLSearchParams(h.routes.at(-1).split('?')[1]);assert.equal(params.get('page'),'4');assert.equal(params.get('service'),'DD');assert.equal(params.get('context'),'islands')
 nodes.find(n=>n.props['aria-label']==='Data inicial').props.onChange({target:{value:'2026-10-30'}});nodes=h.render()
 nodes.find(n=>n.props['aria-label']==='Data final').props.onChange({target:{value:'2026-10-29'}});nodes=h.render()
 assert.equal(h.button(nodes,'Aplicar filtros').props.disabled,true)
 assert.ok(nodes.some(n=>n.props.role==='alert'&&text(n).includes('posterior')))
 h.button(nodes,'Limpar filtros').props.onClick();nodes=h.render()
 assert.equal(h.routes.at(-1),'/ops/envios?')
 for(const label of ['Serviço','Fornecedor','Contexto','Tipo','Motorista','Data inicial','Data final'])assert.equal(nodes.find(n=>n.props['aria-label']===label).props.value,'')
 assert.equal(nodes.find(n=>n.props['aria-label']==='Pesquisar envios').props.value,'')
})

test('a navigation response does not erase newer search text entered while the previous query was loading',t=>{
 const h=harness(t);let nodes=h.render()
 nodes.find(n=>n.props['aria-label']==='Pesquisar envios').props.onChange({target:{value:'CE1'}});nodes=h.render()
 nodes.find(n=>n.props['aria-label']==='Pesquisar envios').props.onKeyDown({key:'Enter'})
 nodes=h.render()
 nodes.find(n=>n.props['aria-label']==='Pesquisar envios').props.onChange({target:{value:'CE12'}});nodes=h.render()
 h.props.initialSearch='CE1';h.render();nodes=h.render()
 assert.equal(nodes.find(n=>n.props['aria-label']==='Pesquisar envios').props.value,'CE12')
})
