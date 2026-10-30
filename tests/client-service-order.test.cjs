const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {matchesClientServiceCount,sortClientsByServiceCount}=createLoader({})('lib/clients/activity-color.ts')

test('service filters distinguish zero, unknown history and the exact color-band boundaries',()=>{
 assert.equal(matchesClientServiceCount(0,'0'),true)
 assert.equal(matchesClientServiceCount(undefined,'0'),false)
 assert.equal(matchesClientServiceCount(undefined,'missing'),true)
 assert.equal(matchesClientServiceCount(0,'known'),true)
 for(const [filter,min,max] of [['1',1,9],['10',10,49],['50',50,199],['200',200,999],['1000',1000,9999]]){
  assert.equal(matchesClientServiceCount(min,filter),true)
  assert.equal(matchesClientServiceCount(max,filter),true)
  assert.equal(matchesClientServiceCount(min-1,filter),false)
  assert.equal(matchesClientServiceCount(undefined,filter),false)
 }
})
test('sorting is numeric, deterministic and non-mutating, with unknown history last in both directions',()=>{
 const input=[{short_name:'Unknown'},{short_name:'Ten',legacy_service_count:10},{short_name:'Zero',legacy_service_count:0},{short_name:'Two',legacy_service_count:2},{short_name:'Alpha',legacy_service_count:2}]
 assert.deepEqual(sortClientsByServiceCount(input,'asc').map(x=>x.short_name),['Zero','Alpha','Two','Ten','Unknown'])
 assert.deepEqual(sortClientsByServiceCount(input,'desc').map(x=>x.short_name),['Ten','Alpha','Two','Zero','Unknown'])
 assert.equal(input[0].short_name,'Unknown')
})

test('the client list sorts the complete result before pagination and combines the count filter with account status',()=>{
 let cursor=0;const slots=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useEffect(){},useMemo:fn=>fn()}
 const jsx=(type,props,key)=>({type,props:props||{},key})
 const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
 const clients=Array.from({length:35},(_,i)=>({id:`id${i}`,code:`C${i}`,short_name:`Loja ${i}`,is_active:true,legacy_service_count:i,category:'Cliente Conta Corrente'}))
 clients[34].portal_access_status='suspended'
 clients.push({id:'unknown',short_name:'Unknown',is_active:true})
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/app/actions/clientes':{},'./ClienteModal':{ClienteModal:()=>null},'./ClientAuthModal':{ClientAuthModal:()=>null},'@/components/ui/button':{Button:'button'}})
 const Client=load('app/ops/entidades/clientes/components/ClientesClient.tsx').ClientesClient
 const render=()=>{cursor=0;return flat(Client({initialClientes:clients}))}
 const rows=()=>render().filter(n=>n.type==='tr'&&n.key).map(n=>n.key)
 render().find(n=>n.type==='select'&&n.props['aria-label']==='Ordenar clientes').props.onChange({target:{value:'services_desc'}})
 assert.equal(rows().length,25)
 assert.equal(rows()[0],'id34')
 render().find(n=>n.type==='select'&&n.props.children?.some?.(n=>n?.props?.value==='Ativo')).props.onChange({target:{value:'Ativo'}})
 assert.equal(rows()[0],'id33')
 render().find(n=>n.type==='select'&&n.props['aria-label']==='Filtrar por serviços históricos').props.onChange({target:{value:'0'}})
 assert.deepEqual(rows(),['id0'])
 render().find(n=>n.type==='select'&&n.props['aria-label']==='Filtrar por serviços históricos').props.onChange({target:{value:'missing'}})
 assert.deepEqual(rows(),['unknown'])
})
