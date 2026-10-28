const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const flatten=n=>Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[]
const textOf=n=>Array.isArray(n)?n.map(textOf).join(''):n&&typeof n==='object'?textOf(n.props?.children):String(n??'')
test('issued unpaid and paid invoices offer resend; opening preloads billing email without issuing or sending',()=>{
 const slots=[];let cursor=0
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useMemo:fn=>fn(),useEffect(){}}
 const jsx=(type,props,key)=>({type,props:props||{},key})
 const empty=()=>null
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({refresh(){}})},'lucide-react':new Proxy({},{get:(_,p)=>p}),
  '../notas-credito/components/CreditNoteButton':{CreditNoteButton:empty},'./InvoiceIssueButton':{InvoiceIssueButton:empty},'./AnimatedDisclosure':{AnimatedDisclosure:empty},'./StoreAvatar':{StoreAvatar:empty},'./PeriodStatementCard':{PeriodStatementCard:empty},'./MoloniConnectModal':{MoloniConnectModal:empty}})
 const Component=load('app/ops/faturacao/contas-corrente/ContasCorrenteClient.tsx').default
 const client={id:'client-a',short_name:'Loja',legal_name:'Loja',billing_email:'billing@example.invalid',email:'other@example.invalid'}
 const base={client_id:client.id,client_name:'Loja',created_at:'2026-10-28',total_value:10,shipment_ids:[]}
 const statements=[{...base,id:'unpaid',statement_number:'EXT-1',moloni_document_id:1,moloni_document_number:'FT 2026/1'},{...base,id:'paid',statement_number:'EXT-2',moloni_document_id:2,moloni_document_number:'FT 2026/2',status:'paid'},{...base,id:'draft',statement_number:'EXT-3',is_pro_forma:true}]
 const before=structuredClone(statements)
 const render=()=>{cursor=0;return flatten(Component({clients:[client],shipments:[],statements}))}
 let nodes=render()
 const buttons=nodes.filter(n=>n.type==='button'&&String(n.props['aria-label']).startsWith('Reenviar fatura'))
 assert.ok(buttons.some(n=>n.props['aria-label'].includes('2026/1')))
 assert.ok(buttons.some(n=>n.props['aria-label'].includes('2026/2')))
 assert.ok(!buttons.some(n=>n.props['aria-label'].includes('EXT-3')))
 let stopped=false
 buttons[0].props.onClick({stopPropagation(){stopped=true}})
 nodes=render()
 assert.equal(stopped,true)
 assert.equal(nodes.find(n=>n.type==='input'&&n.props.type==='email').props.value,'billing@example.invalid')
 assert.ok(nodes.some(n=>n.type==='h3'&&textOf(n)==='Enviar Fatura por Email'))
 assert.deepEqual(statements,before)
})
