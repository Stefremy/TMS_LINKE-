const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {groupInvoiceArchive,isInvoicePaid} = createLoader({})('lib/billing/invoice-archive.ts')
const clients = [
  {id:'a',short_name:'Loja Águia',legal_name:'Empresa A',nif:'123456789'},
  {id:'b',short_name:'Loja Beta',legal_name:'Empresa B'},
]
const invoice = (id,client_id,date,extra={}) => ({id,client_id,created_at:date,moloni_document_id:id,statement_number:`EXT-${id}`,moloni_document_number:`FT 2026/${id}`,total_value:3.91,...extra})

test('Each store has its own folder, including paid and pending invoices, sorted newest first',()=>{
  const statements=[invoice('1','b','2026-10-10'),invoice('2','a','2026-10-01',{status:'paid'}),invoice('3','a','2026-10-15',{client_name:'Old store name'})]
  const before=structuredClone(statements)
  const groups=groupInvoiceArchive(clients,statements)
  assert.deepEqual(groups.map(g=>g.key),['store:a','store:b'])
  assert.deepEqual(groups[0].statements.map(s=>s.id),['3','2'])
  assert.equal(groups[0].name,'Loja Águia')
  assert.equal(groups[0].paidCount,1)
  assert.equal(groups[0].awaitingReceiptCount,1)
  assert.deepEqual(statements,before,'Grouping must not modify the stored documents')
})
test('Different stores remain separate even when they share the same name',()=>{
  const sameNames=clients.map(c=>({...c,short_name:'Same name',legal_name:'Same legal name'}))
  const groups=groupInvoiceArchive(sameNames,[invoice('1','a','2026-10-01'),invoice('2','b','2026-10-02')])
  assert.equal(groups.length,2)
  for(const group of groups)assert.equal(new Set(group.statements.map(s=>s.client_id)).size,1)
})
test('Search supports accents, store name, NIF and specific invoice numbers',()=>{
  const statements=[invoice('1','a','2026-10-01'),invoice('2','a','2026-10-02'),invoice('3','b','2026-10-03')]
  for(const query of ['AGUIA','123456789'])assert.deepEqual(groupInvoiceArchive(clients,statements,query)[0].statements.map(s=>s.id),['2','1'])
  const numberSearch=groupInvoiceArchive(clients,statements,'FT 2026/3')
  assert.equal(numberSearch[0].key,'store:b')
  assert.deepEqual(numberSearch[0].statements.map(s=>s.id),['3'])
  assert.deepEqual(groupInvoiceArchive(clients,statements,'no match'),[])
})
test('Legacy and removed stores stay visible; ambiguous names are never assigned to a store',()=>{
  const ambiguous=[...clients,{id:'c',short_name:'Loja Beta'}]
  const statements=[invoice('1',null,'2026-10-01',{client_name:'Loja Águia'}),invoice('2',null,'2026-10-02',{client_name:'Loja Beta'}),invoice('3','removed','2026-10-03',{client_name:'Archived store'})]
  const groups=groupInvoiceArchive(ambiguous,statements)
  assert.equal(groups.find(g=>g.key==='store:a').statements[0].id,'1')
  assert.equal(groups.find(g=>g.key==='unassigned:loja beta').associationMissing,true)
  assert.equal(groups.find(g=>g.key==='store:removed').name,'Archived store')
  assert.equal(groups.reduce((n,g)=>n+g.statements.length,0),3)
})
test('Failed attempts and proformas stay out of the invoice archive; older paid records remain accessible',()=>{
  const statements=[invoice('1','a','2026-10-01',{moloni_document_id:null,moloni_error:'expired'}),invoice('2','a','2026-10-02',{is_pro_forma:true}),invoice('3','a','invalid',{moloni_document_id:null,status:'paid'}),invoice('4','a','2026-10-04')]
  const groups=groupInvoiceArchive(clients,statements)
  assert.deepEqual(groups[0].statements.map(s=>s.id),['4','3'])
  assert.equal(groups[0].paidCount,1)
  for(const details of [{status:'paid'},{moloni_receipt_id:123},{moloni_receipt_pdf:'receipt.pdf'}])assert.equal(isInvoicePaid(details),true)
})

test('The invoice page renders store folders and an archive shortcut before opening documents',()=>{
  const React=require('react')
  const {renderToStaticMarkup}=require('react-dom/server')
  const load=createLoader({
    react:React,'react/jsx-runtime':require('react/jsx-runtime'),
    'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
    'next/navigation':{useRouter:()=>({refresh(){}})},
    'lucide-react':require('lucide-react'),
    '../notas-credito/components/CreditNoteButton':{CreditNoteButton:()=>null},
    './MoloniConnectModal':{MoloniConnectModal:()=>null},
  })
  const Component=load('app/ops/faturacao/contas-corrente/ContasCorrenteClient.tsx').default
  const html=renderToStaticMarkup(React.createElement(Component,{clients,shipments:[],statements:[invoice('1','a','2026-10-01',{status:'paid'}),invoice('2','b','2026-10-02',{status:'paid'})],moloniConfig:{isConnected:true}}))
  assert.match(html,/Arquivo de Faturas e Extratos por Cliente/)
  assert.match(html,/href="#invoice-archive"/)
  assert.match(html,/Loja Águia/)
  assert.match(html,/Loja Beta/)
  assert.match(html,/Loja, NIF ou número de fatura/)
  assert.equal((html.match(/aria-expanded="false"/g)||[]).length,2)
  assert.ok(!html.includes('/api/statements/'),'Documents remain inside the collapsed store folders')
  const sharedNames=clients.map(c=>({...c,legal_name:'Shared legal name'}))
  const unpaidHtml=renderToStaticMarkup(React.createElement(Component,{clients:sharedNames,shipments:[],statements:[invoice('1','a','2026-10-01',{client_name:'Shared legal name'})],moloniConfig:{isConnected:true}}))
  assert.equal((unpaidHtml.match(/fatura\(s\) a aguardar recibo/g)||[]).length,1,'An invoice must not appear in another store with the same legal name')
})
