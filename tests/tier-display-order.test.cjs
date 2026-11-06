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
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/components/ui/refresh-icon':{RefreshIcon:'icon'},'./DestinationIcons':{PortugalFlag:'icon',SpainFlag:'icon',EuFlag:'icon',DestinationBadge:'icon'},'@/components/ctt-service-badge':{CttServiceBadge:'span'},'@/lib/carrier-logos':{getCarrierLogo:()=>null}})
 const {ServicoModal}=load('app/ops/configuracao/servicos/components/ServicoModal.tsx')
 const flatten=n=>n?.type?.name==='ServicoModalForm'?flatten(n.type(n.props)):Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
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

test('client tier handles reorder by drag and keyboard, save the order and keep negotiated prices on their weights',async()=>{
 const slots=[],effects=[];let cursor=0,saved
 const React={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial==='geral'?'precario':initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial}},
  useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn)}},
 }
 const jsx=(type,props,key)=>({type,props:props||{},key})
 const stub={}
 const loadClient=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,name)=>name}),
  '@/components/shipments/SpecialFeesEditor':stub,'@/components/country-select':stub,
  './ClientPortalAccessControl':stub,'./ClientServiceHistory':stub,'@/components/ctt-service-badge':stub,
  '@/lib/carrier-logos':{getCarrierLogo:()=>null},
  '@/app/actions/clientes':{saveClienteAction:async value=>{saved=value;return {success:true,data:value}}},
  '@/app/actions/client-invitations':stub,
 })
 const {ClienteModal}=loadClient('app/ops/entidades/clientes/components/ClienteModal.tsx')
 const flatten=n=>Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
 const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
 const service={id:'fixture',name:'CTT fixture',category:'Nacional',is_active:true,preferred_carrier_name:'CTT Expresso',fuel_surcharge_pct:0,allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',zone_name:'Continente',tiers}]}
 const original={id:'target',code:'CL1',short_name:'Destino',assigned_linke_service_ids:['fixture'],default_linke_table_id:'fixture',custom_tier_overrides:{'fixture::PT-CONT':[3,7,12]}}
 const props={initialData:original,servicosLinke:[service],onClose(){},onSaved(){}}
 const render=()=>{cursor=0;const nodes=flatten(ClienteModal(props));effects.splice(0).forEach(fn=>fn());return nodes}
 render();let nodes=render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Ajustar Preços')).props.onClick({stopPropagation(){}})
 nodes=render()
 const handles=()=>nodes.filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Mover escalão'))
 const transfer={setData(){}}
 handles()[0].props.onDragStart({dataTransfer:transfer})
 nodes.find(n=>n.type==='tr'&&n.props.children?.some(c=>c?.props?.children?.props?.value==='Até 10 kg')).props.onDrop({preventDefault(){},dataTransfer:transfer})
 nodes=render()
 assert.deepEqual(handles().map(n=>n.props['aria-label']),['Mover escalão Até 5 kg (PT-CONT)','Mover escalão Até 10 kg (PT-CONT)','Mover escalão Até 1 kg (PT-CONT)'])
 handles()[2].props.onKeyDown({key:'ArrowUp',preventDefault(){}});nodes=render()
 assert.deepEqual(handles().map(n=>n.props['aria-label']),['Mover escalão Até 5 kg (PT-CONT)','Mover escalão Até 1 kg (PT-CONT)','Mover escalão Até 10 kg (PT-CONT)'])
 await nodes.find(n=>n.type==='button'&&text(n)==='Gravar Cliente').props.onClick()
 const {validateClientTierOrder}=loadClient('lib/pricing/tier-display-order.ts')
 const persisted=validateClientTierOrder(JSON.parse(JSON.stringify(saved.pricing.service_tier_order)))
 assert.deepEqual(persisted['fixture::PT-CONT'],['t5','t1','t10'])
 assert.equal(saved.pricing.service_weight_tiers,undefined)
 for(const weight of [1,4,9]){
  const before=calculateShipmentPrice(weight,original,[service],'PT','4000-001',{requireConfiguredTariff:true})
  const after=calculateShipmentPrice(weight,{...saved,pricing:{...saved.pricing,service_tier_order:persisted}},[service],'PT','4000-001',{requireConfiguredTariff:true})
  assert.equal(after.basePrice,before.basePrice)
  assert.equal(after.buyPrice,before.buyPrice)
 }
 const inherited={...saved,custom_tier_overrides:{}}
 const revised={...service,zones:[{...service.zones[0],tiers:tiers.map(t=>({...t,sell_price:t.sell_price+1}))}]}
 assert.equal(calculateShipmentPrice(1,inherited,[revised],'PT','4000-001',{requireConfiguredTariff:true}).basePrice,3)
 assert.deepEqual(original.custom_tier_overrides['fixture::PT-CONT'],[3,7,12])
 assert.deepEqual(tiers.map(t=>t.display_order),[undefined,undefined,undefined])
})
