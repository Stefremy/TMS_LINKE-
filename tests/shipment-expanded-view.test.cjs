const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

test('shipment view expands, restores with Escape and removes its keyboard listener',t=>{
  const slots=[],deps=[],effects=[],cleanups=[]
  let cursor=0
  const listeners=new Map(),previous=global.window
  global.window={addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener:(name,callback)=>{if(listeners.get(name)===callback)listeners.delete(name)}}
  t.after(()=>{cleanups.forEach(cleanup=>cleanup?.());global.window=previous})
  const jsx=(type,props)=>({type,props:props||{}})
  const react={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value}]},
    useMemo:callback=>callback(),
    useEffect(callback,values){const index=cursor++;if(!deps[index]||values.some((value,i)=>!Object.is(value,deps[index][i]))){deps[index]=values;effects.push(()=>{cleanups[index]?.();cleanups[index]=callback()})}},
  }
  const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next/navigation':{useRouter:()=>({refresh(){},push(){}})},
    'lucide-react':new Proxy({},{get:(_,name)=>name}),
    '@/lib/hooks/useTrackingPolling':{useTrackingPolling(){}},
    '@/components/shipments/ShipmentParcelWeight':{},'@/components/ui/refresh-icon':{},
    './ActionMenu':{},'./FerramentasMenu':{},'./NovaRecolhaModal':{},'./ManifestModal':{},'./ShipmentLateralDrawer':{},
    '@/app/app/components/ClientShipmentDetailModal':{},'@/lib/carrier-logos':{},'@/lib/status-helpers':{},
    '@/app/actions/ctt':{},'@/app/actions/shipments':{},'@/components/ui/button':{Button:'button'},'@/components/ui/badge':{},
  })
  const {EnviosClient}=load('app/ops/envios/components/EnviosClient.tsx')
  const flat=node=>Array.isArray(node)?node.flatMap(flat):node&&typeof node==='object'?[node,...flat(node.props.children)]:[]
  const render=()=>{cursor=0;const nodes=flat(EnviosClient({envios:[],recolhas:[],clients:[]}));effects.splice(0).forEach(effect=>effect());return nodes}
  const button=nodes=>nodes.find(node=>node.type==='button'&&'aria-pressed' in node.props)
  let nodes=render()
  assert.equal(nodes[0].props['data-expanded'],false)
  assert.equal(button(nodes).props['aria-pressed'],false)
  button(nodes).props.onClick();nodes=render()
  assert.equal(nodes[0].props['data-expanded'],true)
  assert.equal(button(nodes).props['aria-pressed'],true)
  assert.equal(button(nodes).props.title,'Restaurar vista (Esc)')
  listeners.get('keydown')({key:'Escape'});nodes=render()
  assert.equal(nodes[0].props['data-expanded'],false)
  assert.equal(listeners.has('keydown'),false)
  button(nodes).props.onClick();render()
  cleanups.forEach(cleanup=>cleanup?.())
  assert.equal(listeners.has('keydown'),false)
})
