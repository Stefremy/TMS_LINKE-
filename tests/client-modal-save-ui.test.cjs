const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
function harness(initialData={id:'client-a',short_name:'Loja A',payment_due_days:30},servicosLinke=[]){
 const slots=[];let cursor=0,response={success:true,data:{...initialData,id:initialData?.id||'created-id',short_name:'Loja A'}}
 const calls={saved:[],close:0,inputs:[]}
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useEffect(){}}
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/app/actions/clientes':{saveClienteAction:async data=>{calls.inputs.push(data);return typeof response==='function'?response(data):response}},
  '@/app/actions/client-invitations':{},'./ClientPortalAccessControl':{ClientPortalAccessControl:()=>null}})
 const Modal=load('app/ops/entidades/clientes/components/ClienteModal.tsx').ClienteModal
 const props={initialData,servicosLinke,onClose(){calls.close++},onSaved(data){calls.saved.push(data)}}
 const render=()=>{cursor=0;return flat(Modal(props))}
 const button=label=>render().find(n=>n.type==='button'&&text(n)===label)
 const edit=value=>render().find(n=>n.type==='input'&&n.props.placeholder==='Ex: CACTO ou DETAILER').props.onChange({target:{value}})
 return{calls,render,button,edit,response:value=>{response=value}}
}
test('saving keeps the client modal open and marks it saved until the next edit; Close is explicit',async()=>{
 const h=harness()
 assert.ok(h.button('Fechar'))
 await h.button('Gravar Cliente').props.onClick()
 assert.equal(h.calls.saved.length,1)
 assert.equal(h.button('Gravado').props.disabled,true)
 await new Promise(resolve=>setTimeout(resolve,350))
 assert.equal(h.calls.close,0)
 h.edit('Loja Alterada')
 assert.equal(h.button('Gravado'),undefined)
 assert.equal(h.button('Gravar Cliente').props.disabled,false)
 await h.button('Gravar Cliente').props.onClick()
 assert.equal(h.calls.inputs[1].short_name,'Loja Alterada')
 assert.ok(h.button('Gravado'))
 h.button('Fechar').props.onClick()
 assert.equal(h.calls.close,1)
})
test('failed saves keep the modal editable without showing Gravado',async()=>{
 const h=harness();h.response({success:false,error:'Falha de teste'})
 await h.button('Gravar Cliente').props.onClick()
 assert.equal(h.calls.close,0)
 assert.equal(h.calls.saved.length,0)
 assert.equal(h.button('Gravado'),undefined)
 assert.equal(h.button('Gravar Cliente').props.disabled,false)
 assert.ok(h.render().some(n=>text(n).includes('Falha de teste')))
})
test('edits made during saving are not incorrectly marked as already saved',async()=>{
 const h=harness();let resolve
 h.response(()=>new Promise(done=>{resolve=done}))
 const saving=h.button('Gravar Cliente').props.onClick()
 h.edit('Alterado durante gravação')
 resolve({success:true,data:{id:'client-a',short_name:'Loja A'}})
 await saving
 assert.equal(h.button('Gravado'),undefined)
 assert.ok(h.button('Gravar Cliente'))
 assert.equal(h.calls.close,0)
})

test('client modal separates CTT and Correos fees, shows included services and saves editable pending rates without activation',async()=>{
 const h=harness({id:'client-a',short_name:'Loja A',pricing:{special_services_fees:[{special_service_code:'correos_saturday',special_service_name:'Sábado negociado',fee_type:'fixed',fixed_value:12,is_enabled:true}]}})
 let nodes=h.render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Preços & Serviços')).props.onClick()
 nodes=h.render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Taxas adicionais')).props.onClick()
 nodes=h.render()
 assert.ok(nodes.some(n=>n.type==='button'&&text(n).startsWith('CTT Expresso ·')))
 nodes.find(n=>n.type==='button'&&text(n).startsWith('Correos Express ·')).props.onClick()
 nodes=h.render()
 assert.ok(nodes.some(n=>text(n)==='Correos Express · Incluído no frete'))
 assert.ok(nodes.some(n=>text(n).includes('previsão de franja horária gratuita')))
 assert.ok(nodes.some(n=>text(n)==='Retorno da guia de remessa assinada'))
 assert.ok(nodes.some(n=>text(n)==='Suplemento de origem ou destino Espanha'))
 assert.ok(!nodes.some(n=>text(n)==='CTT · Tipo 20'))
 const row=nodes.find(n=>n.type==='div'&&text(n).startsWith('Franja horária específicaCorreos Express')&&n.props.className?.startsWith('p-4 '))
 const rowNodes=flat(row)
 assert.equal(rowNodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.disabled,true)
 const price=rowNodes.find(n=>n.type==='input'&&n.props.type==='number')
 assert.equal(price.props.disabled,false)
 price.props.onChange({target:{value:'0.55'}})
 await h.button('Gravar Cliente').props.onClick()
 const saved=h.calls.inputs[0].pricing.special_services_fees
 assert.equal(saved.find(f=>f.special_service_code==='correos_delivery_window').fixed_value,.55)
 assert.equal(saved.find(f=>f.special_service_code==='correos_delivery_window').is_enabled,false)
 assert.equal(saved.find(f=>f.special_service_code==='correos_saturday').fixed_value,12)
})

test('custom commercial names distinguish services when associating tables to a client',()=>{
 const table={id:'islas-a',name:'Ilhas',code:'LK-ISLAS-A',pricing_profile:'Aldara Ilhas Aéreo',is_active:true,zones:[{zone_code:'PT-ILHAS',tiers:[{weight_max:1,sell_price:10,enabled:true}]}]}
 const h=harness({id:'client-a',short_name:'Loja A',assigned_linke_service_ids:[table.id]},[table]);let nodes=h.render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Preços & Serviços')).props.onClick();nodes=h.render()
 assert.ok(nodes.some(n=>text(n)==='Aldara Ilhas Aéreo'))
})
