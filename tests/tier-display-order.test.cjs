const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {getTierDisplayEntries:entries,moveTierDisplayOrder:move}=load('lib/pricing/tier-display-order.ts')
const {calculateShipmentPrice}=load('lib/pricing/calculate-shipment-price.ts')
const tiers=[1,5,10].map(weight_max=>({id:`t${weight_max}`,label:`Até ${weight_max} kg`,weight_max,cost_price:weight_max,sell_price:weight_max*2,margin_pct:100,delivery_time:'24h',enabled:true}))
const ids=t=>entries(t).map(e=>e.tier.id)
test('moving tiers changes visual order while preserving original indexes and every price field',()=>{
 const before=structuredClone(tiers)
 const moved=move(tiers,0,2)
 assert.deepEqual(ids(moved),['t5','t10','t1'])
 assert.deepEqual(moved.map(t=>t.id),['t1','t5','t10'])
 assert.deepEqual(moved.map(({display_order,...tier})=>tier),before)
 assert.deepEqual(tiers,before)
 assert.deepEqual(ids(move(moved,0,1)),['t1','t5','t10'])
 assert.equal(move(tiers,-1,2),tiers)
 assert.equal(move(tiers,1,1),tiers)
})
test('client negotiated prices remain attached to their original tier after visual reorder and serialization',()=>{
 const s={id:'fixture',name:'CTT fixture',preferred_carrier_name:'CTT Expresso',fuel_surcharge_pct:0,allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers}]}
 const client={default_linke_table_id:'fixture',custom_tier_overrides:{fixture:[3,7,12]},pricing:{}}
 const reordered=JSON.parse(JSON.stringify({...s,zones:[{...s.zones[0],tiers:move(tiers,1,0)}]}))
 for(const weight of [1,4,9]){
  const before=calculateShipmentPrice(weight,client,[s],'PT','4000-001',{requireConfiguredTariff:true})
  const after=calculateShipmentPrice(weight,client,[reordered],'PT','4000-001',{requireConfiguredTariff:true})
  assert.equal(after.sellPrice,before.sellPrice)
  assert.equal(after.tierLabel,before.tierLabel)
 }
 assert.deepEqual(ids(reordered.zones[0].tiers),['t5','t1','t10'])
})

test('editor grip supports drop and keyboard moves and submits the saved display order',async()=>{
 const slots=[],effects=[];let cursor=0
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial==='geral'?'precos':initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn)}}}
 const jsx=(type,props,key)=>({type,props:props||{},key})
 const module=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/components/ui/refresh-icon':{RefreshIcon:'icon'},'./DestinationIcons':{PortugalFlag:'icon',SpainFlag:'icon',EuFlag:'icon',DestinationBadge:'icon'},'@/components/ctt-service-badge':{CttServiceBadge:'span'},'@/lib/carrier-logos':{getCarrierLogo:()=>null}})
 const {ServicoModal}=module('app/ops/configuracao/servicos/components/ServicoModal.tsx')
 const flatten=n=>Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
 let saved,closed=0,saveMode='success'
 const props={isOpen:true,initialData:{name:'Fixture',code:'LK-X',preferred_carrier_name:'CTT Expresso',webservice_service_code:'EMSF056.01',zones:[{zone_code:'PT-CONT',zone_name:'Portugal',tiers}]},fornecedores:[],webservices:[],onClose(){closed++},onSave:async data=>{saved=data;if(saveMode==='fail')return false;if(saveMode==='throw')throw Error('Falha simulada');return {...data,id:'fixture'}}}
 const render=()=>{cursor=0;const nodes=flatten(ServicoModal(props));effects.splice(0).forEach(fn=>fn());return nodes}
 render();let nodes=render()
 const textOf=n=>Array.isArray(n)?n.map(textOf).join(''):n&&typeof n==='object'?textOf(n.props?.children):String(n??'')
 nodes.find(n=>n.type==='button'&&textOf(n).includes('Tabela de Preços')).props.onClick()
 nodes=render()
 const handles=()=>nodes.filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Mover escalão'))
 assert.equal(handles().length,3)
 const transfer={setData(){},effectAllowed:'',dropEffect:''}
 handles()[0].props.onDragStart({dataTransfer:transfer})
 const lastRow=nodes.find(n=>n.type==='tr'&&flatten(n).includes(handles()[2]))
 lastRow.props.onDrop({preventDefault(){},dataTransfer:transfer});nodes=render()
 assert.deepEqual(handles().map(n=>n.props['aria-label']),['Mover escalão Até 5 kg','Mover escalão Até 10 kg','Mover escalão Até 1 kg'])
 handles()[2].props.onKeyDown({key:'ArrowUp',preventDefault(){}});nodes=render()
 assert.deepEqual(handles().map(n=>n.props['aria-label']),['Mover escalão Até 5 kg','Mover escalão Até 1 kg','Mover escalão Até 10 kg'])
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.deepEqual(ids(saved.zones[0].tiers),['t5','t1','t10'])
 assert.deepEqual(saved.zones[0].tiers.map(t=>t.id),['t1','t5','t10'])
 nodes=render()
 assert.equal(closed,0,'Saving must keep the modal open')
 assert.equal(nodes.find(n=>n.type==='button'&&textOf(n)==='Gravado').props.disabled,true)
 const edit=nodes.find(n=>n.type==='input'&&n.props.value==='Até 5 kg')
 edit.props.onChange({target:{value:'Escalão editado'}});nodes=render()
 assert.ok(nodes.some(n=>n.type==='button'&&textOf(n)==='Gravar Alterações'))
 saveMode='fail'
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});nodes=render()
 assert.equal(saved.id,'fixture','Later saves must reuse the returned table ID rather than creating another table')
 assert.equal(closed,0)
 assert.ok(nodes.some(n=>n.props.role==='alert'))
 assert.equal(nodes.some(n=>n.type==='button'&&textOf(n)==='Gravado'),false)
 saveMode='throw'
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});nodes=render()
 assert.ok(nodes.some(n=>n.props.role==='alert'&&textOf(n)==='Falha simulada'))
 saveMode='success'
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});nodes=render()
 assert.ok(nodes.some(n=>n.type==='button'&&textOf(n)==='Gravado'))
 nodes.find(n=>n.type==='button'&&textOf(n)==='Fechar').props.onClick()
 assert.equal(closed,1)

})
