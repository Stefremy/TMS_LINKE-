const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props?.children)]:[]
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'')
function harness(result=true){
 const slots=[];let cursor=0,closed=0,calls=0
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useEffect(){}}
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p})})
 const {DuplicateServicoModal}=load('app/ops/configuracao/servicos/components/DuplicateServicoModal.tsx')
 const props={isOpen:true,servico:{id:'fixture',name:'Tabela de teste',zones:[]},onClose(){closed++},onConfirmDuplicate:async()=>{calls++;return result}}
 const render=()=>{cursor=0;return flat(DuplicateServicoModal(props))}
 return{render,closed:()=>closed,calls:()=>calls}
}
test('creating a variant stays open with Gravado and explicit Fechar, preventing accidental duplicate creation',async()=>{
 const h=harness();let nodes=h.render()
 const submit=nodes.find(n=>n.type==='form').props.onSubmit
 await submit({preventDefault(){}});nodes=h.render()
 assert.equal(h.closed(),0)
 assert.equal(nodes.find(n=>n.type==='button'&&text(n)==='Gravado').props.disabled,true)
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.equal(h.calls(),1)
 assert.ok(nodes.filter(n=>['input','select'].includes(n.type)).every(n=>n.props.disabled))
 nodes.find(n=>n.type==='button'&&text(n)==='Fechar').props.onClick()
 assert.equal(h.closed(),1)
})
test('failed variant creation remains editable and cannot be presented as saved',async()=>{
 const h=harness(false);let nodes=h.render()
 await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});nodes=h.render()
 assert.equal(h.closed(),0)
 assert.equal(nodes.some(n=>n.type==='button'&&text(n)==='Gravado'),false)
 assert.ok(nodes.some(n=>n.props.role==='alert'))
 assert.ok(nodes.filter(n=>['input','select'].includes(n.type)).every(n=>!n.props.disabled))
})
