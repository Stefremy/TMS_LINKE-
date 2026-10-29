const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
function harness(profile='Standard / Geral',initialOverride={}){
 const slots=[],effects=[];let cursor=0,saved
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn)}}}
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/components/ui/refresh-icon':{RefreshIcon:'icon'},'./DestinationIcons':{PortugalFlag:'icon',SpainFlag:'icon',EuFlag:'icon',DestinationBadge:'icon'},'@/components/ctt-service-badge':{CttServiceBadge:'span'},'@/lib/carrier-logos':{getCarrierLogo:()=>null}})
 const {ServicoModal}=load('app/ops/configuracao/servicos/components/ServicoModal.tsx')
 const props={isOpen:true,initialData:{id:'fixture',name:'Fixture',code:'LK-X',pricing_profile:profile,preferred_carrier_name:'CTT Expresso',webservice_service_code:'EMSF056.01',zones:[{zone_code:'PT-CONT',tiers:[{id:'tier',weight_max:1,cost_price:2,sell_price:3,margin_pct:50}]}],...initialOverride},fornecedores:[],webservices:[],onClose(){},onSave:async data=>{saved=data;return data}}
 const render=()=>{cursor=0;const nodes=flat(ServicoModal(props));effects.splice(0).forEach(fn=>fn());return nodes}
 render()
 return{render,saved:()=>saved}
}
test('Outros opens a required text field and saves the commercial name with unchanged prices',async()=>{
 const h=harness();let nodes=h.render()
 nodes.find(n=>n.type==='button'&&text(n).startsWith('Outros')).props.onClick();nodes=h.render()
 const input=nodes.find(n=>n.type==='input'&&n.props.id==='custom-commercial-profile')
 assert.equal(input.props.required,true)
 input.props.onChange({target:{value:'Ilhas aéreo · Aldara'}});nodes=h.render()
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.equal(h.saved().pricing_profile,'Ilhas aéreo · Aldara')
 assert.equal(h.saved().zones[0].tiers[0].sell_price,3)
})
test('saved custom profiles reopen as Outros and switching back to a standard profile is reversible',()=>{
 const h=harness('Aldara Marítimo');let nodes=h.render()
 assert.equal(nodes.find(n=>n.type==='button'&&text(n).startsWith('Outros')).props['aria-pressed'],true)
 assert.equal(nodes.find(n=>n.props.id==='custom-commercial-profile').props.value,'Aldara Marítimo')
 nodes.find(n=>n.type==='button'&&text(n).startsWith('Standard / Geral')).props.onClick();nodes=h.render()
 assert.ok(!nodes.some(n=>n.props.id==='custom-commercial-profile'))
})

test('Baleares tariff zones are visible as selected destinations and toggle without replacing their prices',async()=>{
 const {buildBalearesExpressZones}=createLoader({})('lib/services/correos/baleares-tariffs.ts')
 const zones=buildBalearesExpressZones(25)
 const h=harness('Standard / Geral',{preferred_carrier_name:'CORREOS.EXPRESS',webservice_connection_id:'correos_express',webservice_service_code:'26',zones,allowed_zones:zones.map(z=>z.zone_code)})
 let nodes=h.render();nodes.find(n=>n.type==='button'&&text(n).includes('Destinos Autorizados')).props.onClick();nodes=h.render()
 const destination=code=>nodes.find(n=>n.type==='button'&&text(n).endsWith(code))
 for(const zone of zones)assert.equal(destination(zone.zone_code).props['aria-pressed'],true)
 assert.equal(destination('ES-ILHAS'),undefined)
 destination(zones[1].zone_code).props.onClick();nodes=h.render()
 assert.equal(destination(zones[1].zone_code).props['aria-pressed'],false)
 assert.equal(destination(zones[0].zone_code).props['aria-pressed'],true)
 destination(zones[1].zone_code).props.onClick();nodes=h.render()
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.deepEqual(h.saved().allowed_zones,zones.map(z=>z.zone_code))
 assert.deepEqual(h.saved().zones.map(z=>z.tiers.map(t=>t.cost_price)),zones.map(z=>z.tiers.map(t=>t.cost_price)))
 nodes=h.render();nodes.find(n=>n.type==='button'&&text(n).includes('Tabela de Preços')).props.onClick();nodes=h.render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Adicionar Zona')).props.onClick();nodes=h.render()
 assert.ok(!nodes.some(n=>n.type==='option'&&n.props.value==='ES-ILHAS'))
})
