const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader} = require('./helpers/load-typescript.cjs')
const flatten = n => Array.isArray(n) ? n.flatMap(flatten) : n && typeof n === 'object' ? [n,...flatten(n.props?.children)] : []
const textOf = n => Array.isArray(n) ? n.map(textOf).join('') : n && typeof n === 'object' ? textOf(n.props?.children) : String(n ?? '')
function harness(t) {
 const savedConfirm=globalThis.confirm
 let approved=false
 const prompts=[]
 globalThis.confirm=msg=>{prompts.push(msg);return approved}
 t.after(()=>{if(savedConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=savedConfirm})
 const slots=[];let cursor=0
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useEffect(){}}
 const jsx=(type,props,key)=>({type,props:props||{},key})
 const load=createLoader({react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '@/app/actions/clientes':{},'@/app/actions/client-invitations':{},'./ClientPortalAccessControl':{ClientPortalAccessControl:()=>null}})
 const Modal=load('app/ops/entidades/clientes/components/ClienteModal.tsx').ClienteModal
 const services=[{id:'base',name:'Tabela mãe de teste',is_primordial:true},{id:'custom',name:'Variante cliente'},{id:'new-base',name:'Outra mãe',is_primordial:true},{id:'new-custom',name:'Outra variante'}].map(s=>({...s,code:s.id,zones:[],pricing_profile:'Standard / Geral'}))
 const props={initialData:{id:'fixture',short_name:'Cliente teste',assigned_linke_service_ids:['base','custom'],default_linke_table_id:'base',custom_tier_overrides:{base:[5]}},servicosLinke:services,onClose(){},onSaved(){}}
 const render=()=>{cursor=0;return flatten(Modal(props))}
 const button=(nodes,label)=>nodes.find(n=>n.type==='button'&&(n.props['aria-label']===label||textOf(n)===label))
 let nodes=render();button(nodes,'Preços & Serviços2 serviços').props.onClick()
 return {render,button,prompts,approve:v=>{approved=v},form:()=>slots.find(s=>s&&typeof s==='object'&&s.short_name==='Cliente teste')}
}
test('cards cannot revoke authorization; explicit removal requires confirmation and keeps prices',t=>{
 const h=harness(t);let nodes=h.render()
 const title=nodes.find(n=>n.type==='span'&&textOf(n)==='Tabela mãe de teste')
 const findParent=child=>nodes.find(n=>Array.isArray(n.props.children)?n.props.children.includes(child):n.props.children===child)
 let parent=title
 for(let i=0;i<4;i++){parent=findParent(parent);assert.equal(parent.props.onClick,undefined)}
 const remove=h.button(nodes,'Remover autorização de Tabela mãe de teste')
 remove.props.onClick();assert.deepEqual(h.form().assigned_linke_service_ids,['base','custom'])
 h.approve(true);remove.props.onClick()
 assert.deepEqual(h.form().assigned_linke_service_ids,['custom'])
 assert.equal(h.form().default_linke_table_id,'')
 assert.deepEqual(h.form().custom_tier_overrides,{base:[5]})
})
test('table filtering changes visibility, bulk authorization adds only shown tables and preserves hidden selections',t=>{
 const h=harness(t);let nodes=h.render()
 const filter=nodes.find(n=>n.type==='select'&&flatten(n.props.children).some(c=>c.type==='option'&&c.props.value==='base'))
 filter.props.onChange({target:{value:'base'}});nodes=h.render()
 assert.ok(h.button(nodes,'Remover autorização de Tabela mãe de teste'))
 assert.equal(h.button(nodes,'Remover autorização de Variante cliente'),undefined)
 h.button(nodes,'Autorizar todas as tabelas primordiais apresentadas').props.onClick()
 assert.deepEqual(h.form().assigned_linke_service_ids,['base','custom','new-base'])
 h.button(h.render(),'Remover todas as autorizações').props.onClick()
 assert.equal(h.form().assigned_linke_service_ids.length,3)
 assert.match(h.prompts.at(-1),/incluindo os ocultos/)
 h.approve(true);h.button(h.render(),'Remover todas as autorizações').props.onClick()
 assert.deepEqual(h.form().assigned_linke_service_ids,[])
 assert.deepEqual(h.form().custom_tier_overrides,{base:[5]})
})

 test('add-service dropdowns separate primordial and custom tables independently of the authorized filter',t=>{
 const h=harness(t);let nodes=h.render()
 nodes.find(n=>n.type==='select'&&flatten(n.props.children).some(c=>c.type==='option'&&c.props.value==='base')).props.onChange({target:{value:'base'}})
 nodes=h.render()
 const groups=nodes.filter(n=>n.type==='details'&&textOf(n).includes('Adicionar serviços · Tabelas'))
 assert.equal(groups.length,2)
 assert.match(textOf(groups[0]),/Tabelas primordiais.*1 não autorizados/)
 assert.match(textOf(groups[1]),/Tabelas personalizadas.*1 não autorizados/)
 assert.ok(flatten(groups[0]).some(n=>n.props?.['aria-label']==='Autorizar Outra mãe'))
 assert.ok(!flatten(groups[0]).some(n=>n.props?.['aria-label']==='Autorizar Outra variante'))
 assert.ok(flatten(groups[1]).some(n=>n.props?.['aria-label']==='Autorizar Outra variante'))
 h.button(nodes,'Autorizar todas as tabelas personalizadas apresentadas').props.onClick()
 assert.deepEqual(h.form().assigned_linke_service_ids,['base','custom','new-custom'])
 assert.match(textOf(h.render().find(n=>n.type==='details'&&textOf(n).includes('Adicionar serviços · Tabelas personalizadas'))),/0 não autorizados/)
 })
