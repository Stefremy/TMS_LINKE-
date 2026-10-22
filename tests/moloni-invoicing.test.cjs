const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const TENANT = '11111111-1111-1111-1111-111111111111'
const CLIENT = '22222222-2222-2222-2222-222222222222'
const SHIPMENT = '44444444-4444-4444-4444-444444444444'
const connection = (details = {}) => ({tenant_id: TENANT, action: 'moloni_connection_config', created_at:'2026-10-15', details:{company_id:'42',refresh_token:'saved-refresh',...details}})
function invoiceHarness({failInvoice=false,failPdf=false,connected=true, existing=[], failArchive=false, clientDueDays=undefined, shipmentRows, fiscalDocument}={}) {
  const db = fakeSupabase({audit_log: [...(connected ? [connection()] : []), ...existing], shipments:shipmentRows || [
    {id:SHIPMENT,client_id:CLIENT,tenant_id:TENANT,sell_price:3.91,service_type:'Nacional'}
  ]}, q=>failArchive&&q.write?.kind==='insert'&&q.write.value.action==='billing_statement'?{message:'unavailable'}:null)
  let claims = 0
  db.client.rpc = async (name) => { claims++; assert.equal(name, 'claim_billing_shipments'); return { data: null, error: null } }
  let issued = 0, lastInvoicePayload, lastReceiptPayload
  const load = createLoader({
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/lib/auth/context':{getTenantId:async()=>TENANT,requireEmployee:async()=>({tenant_id:TENANT}),requireUser:async()=>({tenant_id:TENANT})},
    '@/lib/config/public-origins':{moloniRedirectUri:()=> 'https://fixture.invalid/callback'},
    '@/app/actions/clientes':{getClientesAction:async()=>[{id:CLIENT,tenant_id:TENANT,nif:'999999990',payment_due_days:clientDueDays}]},
    '@/app/actions/shipments':{},
    '@/lib/services/shipments/shipment-fetcher':{SHIPMENT_LIST_COLUMNS:'*'},
    '@/app/actions/billing-config':{getBillingConfigAction:async()=>({defaultVatRate:23})},
    'next/cache':{revalidatePath(){}},
    '@/lib/moloni/moloni-client':{MoloniClient:class {
      async request(endpoint){assert.equal(endpoint,'documents/getOne');return fiscalDocument}
      async createReceipt(payload){lastReceiptPayload=payload;return {document_id:321}}
      async getCustomerByVat(){return {customer_id:1}}
      async updateCustomer(){}
      async getTaxId(){return 1}
      async getDocumentSet(){return 1}
      async getGenericProductId(){return 1}
      async createInvoice(payload){lastInvoicePayload=payload;issued++;if(failInvoice)throw new Error('Sessão Moloni expirada');return {document_id:123}}
      async getDocumentPDFLink(){if(failPdf)throw new Error('PDF unavailable');return 'https://fixture.invalid/invoice.pdf'}
      async getDocumentNumber(){return 'FT 2026/123'}
    }},
  })
  return {db,load, get lastReceiptPayload(){return lastReceiptPayload}, get claims(){return claims}, get lastInvoicePayload(){return lastInvoicePayload}, get issued(){return issued}, emit:status=>load('app/actions/moloni.ts').internalEmitInvoice(
    {id:CLIENT,tenant_id:TENANT,nif:'999999990'},[{id:SHIPMENT,status,sell_price:3.91,service_type:'Nacional'}])}
}

test('cancelled and draft shipments are rejected from authoritative rows before claiming or issuing, even with a forged pending status',async()=>{
  for (const status of ['cancelado','anulado','rascunho','draft','cancelled','canceled']) {
    const h=invoiceHarness({shipmentRows:[{id:SHIPMENT,tenant_id:TENANT,client_id:CLIENT,status,sell_price:3.91}]})
    await assert.rejects(h.emit('pendente'),/cancelados, anulados ou em rascunho/)
    assert.equal(h.claims,0);assert.equal(h.issued,0);assert.equal(h.db.writes.length,0)
  }
})

test('manual billing page excludes cancelled test fixtures and drafts while keeping pending and delivered shipments',async()=>{
  const shipments=['cancelado','anulado','rascunho','draft','cancelled','canceled','pendente','entrada_rede','entregue']
    .map((status,i)=>({id:String(i),client_id:CLIENT,status,sell_price:3.91}))
  const jsx=(type,props)=>({type,props})
  const load=createLoader({
    react:{},
    'react/jsx-runtime':{jsx,jsxs:jsx},
    '@/lib/auth/context':{requirePermission:async()=>({tenant_id:TENANT,role:'admin'})},
    '@/app/actions/clientes':{getClientesAction:async()=>[]},
    '@/app/actions/shipments':{getShipmentsAction:async()=>shipments},
    '@/app/actions/moloni':{getBillingStatementsAction:async()=>[],getMoloniConfigAction:async()=>({})},
    '@/lib/billing/recurring-statements':{recurringPreview:async()=>[],loadPeriodStatements:async()=>[]},
    './ContasCorrenteClient':{default:()=>null},
    './RecurringStatementsPanel':{RecurringStatementsPanel:()=>null},
  })
  const page=await load('app/ops/faturacao/contas-corrente/page.tsx').default()
  assert.deepEqual(page.props.children.props.shipments.map(s=>s.status),['pendente','entrada_rede','entregue'])
})

test('grouped invoices recover historical fuel and itemized supplements without changing the charged total',async()=>{
 const snapshot={id:SHIPMENT,client_id:CLIENT,sell_price:6.5,base_price:4,fuel_tax_amount:0.5,
  special_fees_amount:2,special_fees_description:JSON.stringify([{name:'Frágil',amount:1.5},{name:'SMS',amount:0.5}])}
 const h=invoiceHarness({shipmentRows:[{id:SHIPMENT,tenant_id:TENANT,client_id:CLIENT,sell_price:6.5,service_type:'Nacional'}],
  existing:[{tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-01',details:snapshot}]})
 const result=await h.emit('pending');assert.equal(result.success,true)
 const lines=h.lastInvoicePayload.products
 assert.deepEqual(lines.map(l=>l.price),[4,0.5,1.5,0.5])
 assert.match(lines[1].name,/Combustível/);assert.match(lines[2].name,/Frágil/);assert.match(lines[3].name,/SMS/)
 assert.equal(lines.reduce((n,l)=>n+Math.round(l.price*100),0),650)
 const saved=h.db.writes.find(w=>w.kind==='insert'&&w.value.action==='billing_statement').value.details
 assert.equal(saved.total_value,6.5);assert.equal(saved.shipments[0].fuel_tax_amount,0.5)
 assert.equal(saved.shipments[0].special_fees_amount,2)
})

test('a previously issued invoice is never rebuilt or reissued to add breakdown, even if its PDF is missing',async()=>{
 const h=invoiceHarness({existing:[{id:'old-statement',tenant_id:TENANT,action:'billing_statement',
  details:{id:'old-statement',client_id:CLIENT,moloni_document_id:28,total_value:12.21,shipments:[]}}]})
 const result=await h.load('app/actions/moloni.ts').emitMoloniInvoiceForStatementAction('old-statement')
 assert.equal(result.alreadyEmitted,true);assert.equal(result.moloniDocumentId,28)
 assert.equal(h.issued,0);assert.equal(h.db.writes.length,0)
})

test('Moloni refusal is returned as failure, without statement or billed-shipment writes',async()=>{
  const h=invoiceHarness({failInvoice:true});const result=await h.emit('pending')
  assert.equal(result.success,false);assert.match(result.error,/expirada/);assert.equal(h.db.writes.length,0)
})
test('Missing Moloni connection never silently creates an internal statement',async()=>{
  const h=invoiceHarness({connected:false});const result=await h.emit('pending')
  assert.equal(result.success,false);assert.equal(h.issued,0);assert.equal(h.db.writes.length,0)
})
test('Both pending and delivered shipments can be invoiced; the official document ID is returned',async()=>{
  for(const status of ['pending','delivered']) {
    const h=invoiceHarness();const result=await h.emit(status)
    assert.equal(result.success,true);assert.equal(result.moloniDocumentId,123)
    assert.match(result.moloniDocumentPdf,/moloni-pdf$/)
    assert.equal(h.db.writes.find(w=>w.kind==='insert').value.details.moloni_document_id,123)
  }
})
test('PDF failure after issuance preserves the real invoice ID and warns rather than offering reissuance',async()=>{
  const h=invoiceHarness({failPdf:true});const result=await h.emit('pending')
  assert.equal(result.success,true);assert.equal(result.moloniDocumentId,123)
  assert.equal(result.moloniDocumentPdf,null);assert.match(result.moloniError,/PDF/)
  assert.equal(h.db.writes.find(w=>w.kind==='insert').value.details.moloni_document_id,123)
})
function tokenHarness(rows,handler) {
  const db=fakeSupabase({audit_log:rows})
  const load=createLoader({
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/lib/auth/context':{getTenantId:async()=>TENANT},fetch:handler,
  })
  const {MoloniClient}=load('lib/moloni/moloni-client.ts')
  return {db,MoloniClient}
}
test('A saved rotated refresh token takes precedence over an obsolete deployment token',async()=>{
  const requests=[]
  const h=tokenHarness([connection()],async(url)=>{
    requests.push(url)
    return new Response(JSON.stringify(url.includes('/grant/')?{access_token:'fresh-access',refresh_token:'next-refresh',expires_in:3600}:{ok:true}))
  })
  await new h.MoloniClient({companyId:'42',refreshToken:'obsolete-deployment-token'}).request('fixture/read')
  assert.equal(new URL(requests[0]).searchParams.get('refresh_token'),'saved-refresh')
  assert.equal(h.db.writes[0].value.details.refresh_token,'next-refresh')
  assert.equal(h.db.writes[0].value.details.access_token,'fresh-access')
  assert.equal(h.db.writes[0].value.tenant_id,TENANT)
  assert.ok(h.db.queries[0].filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
  assert.ok(h.db.queries[0].filters.some(f=>f.field==='details->>company_id'&&f.value==='42'))
})
test('A cold server instance reuses the persisted valid access token without rotating again',async()=>{
  const requests=[]
  const h=tokenHarness([connection({access_token:'durable-access',access_token_expires_at:Date.now()+60000})],async(url)=>{
    requests.push(url);return new Response('{}')
  })
  await new h.MoloniClient({companyId:'42',refreshToken:'obsolete'}).request('fixture/read')
  assert.equal(requests.length,1);assert.ok(!requests[0].includes('/grant/'))
  assert.equal(new URL(requests[0]).searchParams.get('access_token'),'durable-access')
  assert.equal(h.db.writes.length,0)
})
test('Another tenant/company session is never used for authentication',async()=>{
  const foreign=connection();foreign.tenant_id='other-tenant'
  const h=tokenHarness([foreign,connection({company_id:'99'})],async(url)=>{
    assert.equal(new URL(url).searchParams.get('refresh_token'),'own-fallback')
    return new Response(JSON.stringify({error:'invalid_grant'}))
  })
  await assert.rejects(new h.MoloniClient({companyId:'42',refreshToken:'own-fallback'}).request('fixture/read'),/expirada/)
  assert.equal(h.db.writes.length,0)
})

test('Each mounted invoice button owns its loading state, from either row and after errors or cancellation',async()=>{
  const stores=new Map();let frame,resolveAction,rejectAction;const alerts=[],calls=[]
  const react={
    useState(initial){const {slots}=frame,i=frame.cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
    useRef(initial){const {slots}=frame,i=frame.cursor++;return slots[i]||={current:initial}},
    useMemo(fn){return fn()},
  }
  const jsx=(type,props,key)=>({type,props:props||{},key})
  // Render every actual function component with its own persistent hook store.
  function renderNode(node,path='root') {
    if(Array.isArray(node))return node.map((child,i)=>renderNode(child,path+'/'+(child?.key??i)))
    if(!node||typeof node!=='object')return node
    if(typeof node.type==='function'){
      const previous=frame
      const slots=stores.get(path)||[];stores.set(path,slots);frame={slots,cursor:0}
      let output
      try{output=node.type(node.props)}finally{frame=previous}
      return renderNode(output,path+'/view')
    }
    return {...node,props:{...node.props,children:renderNode(node.props.children,path+'/children')}}
  }
  const load=createLoader({
    react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next/link':{default:'link'},'next/navigation':{useRouter:()=>({refresh(){}})},
    'lucide-react':new Proxy({},{get:(_,name)=>String(name)}),
    '../notas-credito/components/CreditNoteButton':{CreditNoteButton:()=>null},
    './MoloniConnectModal':{MoloniConnectModal:'modal'},
    '@/app/actions/moloni':{emitInvoiceAction:clientId=>{calls.push(clientId);return new Promise((resolve,reject)=>{resolveAction=resolve;rejectAction=reject})}},
  })
  const Component=load('app/ops/faturacao/contas-corrente/ContasCorrenteClient.tsx').default
  const clients=[{id:'a',legal_name:'Store A'},{id:'b',legal_name:'Store B'}]
  const props={clients,shipments:clients.map(c=>({id:c.id,client_id:c.id,sell_price:3.91,created_at:'2026-10-15'})),moloniConfig:{isConnected:true}}
  const render=()=>renderNode(jsx(Component,props))
  const flatten=node=>Array.isArray(node)?node.flatMap(flatten):node&&typeof node==='object'?[node,...flatten(node.props?.children)]:[]
  const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'')
  const buttons=()=>flatten(render()).filter(n=>n.type==='button'&&/Emitir Fatura Moloni|A emitir\.\.\./.test(text(n)))
  const oldConfirm=global.confirm,oldAlert=global.alert
  global.confirm=()=>true;global.alert=msg=>alerts.push(msg)
  try{
    for(const selected of [0,1]){
      const pending=buttons()[selected].props.onClick({stopPropagation(){}})
      await new Promise(resolve=>setImmediate(resolve))
      const active=buttons()
      assert.deepEqual(active.map(text),selected===0?['A emitir...','Emitir Fatura Moloni']:['Emitir Fatura Moloni','A emitir...'])
      assert.deepEqual(active.map(b=>b.props['aria-busy']),[selected===0,selected===1])
      const before=calls.length
      await active[1-selected].props.onClick({stopPropagation(){}})
      assert.equal(calls.length,before,'Disabled other row must not issue another invoice')
      if(selected===0)resolveAction({success:false,error:'Sessão expirada'})
      else rejectAction(new Error('Network unavailable'))
      await pending
      assert.deepEqual(buttons().map(text),['Emitir Fatura Moloni','Emitir Fatura Moloni'])
      assert.deepEqual(buttons().map(b=>b.props['aria-busy']),[false,false])
    }
    assert.match(alerts[0],/Sessão expirada/)
    assert.match(alerts[1],/confirmar o resultado/)
    global.confirm=()=>false
    const before=calls.length
    await buttons()[0].props.onClick({stopPropagation(){}})
    assert.equal(calls.length,before)
    assert.deepEqual(buttons().map(b=>b.props['aria-busy']),[false,false])
  }finally{global.confirm=oldConfirm;global.alert=oldAlert}
})

test('An already invoiced shipment is rejected before any Moloni mutation',async()=>{
  const h=invoiceHarness({existing:[{tenant_id:TENANT,action:'billing_statement',details:{client_id:CLIENT,moloni_document_id:77,shipment_ids:[SHIPMENT]}}]})
  const result=await h.load('app/actions/moloni.ts').emitInvoiceAction(CLIENT,[SHIPMENT])
  assert.equal(result.success,false);assert.match(result.error,/já tem fatura/);assert.equal(h.issued,0)
})
test('A shipment outside the selected client is rejected before invoicing',async()=>{
  const h=invoiceHarness()
  const result=await h.load('app/actions/moloni.ts').emitInvoiceAction('other-client',[SHIPMENT])
  assert.equal(result.success,false);assert.equal(h.issued,0)
})
test('An archive failure after invoice creation explicitly tells the operator not to repeat',async()=>{
  const h=invoiceHarness({failArchive:true})
  await assert.rejects(h.emit('pending'),/123.*Não repita/)
  assert.equal(h.issued,1)
})
test('Official PDF recovery uses the saved tenant connection when no deployment token exists',async t=>{
  const previous={refresh:process.env.MOLONI_REFRESH_TOKEN,company:process.env.MOLONI_COMPANY_ID}
  delete process.env.MOLONI_REFRESH_TOKEN;delete process.env.MOLONI_COMPANY_ID
  t.after(()=>{for(const [key,value] of [['MOLONI_REFRESH_TOKEN',previous.refresh],['MOLONI_COMPANY_ID',previous.company]])value===undefined?delete process.env[key]:process.env[key]=value})
  const db=fakeSupabase({audit_log:[connection()]});let config
  const load=createLoader({
    '@/lib/services/billing/document-access':{
      loadFinancialDocument:async()=>({supabase:db.client,ctx:{tenant_id:TENANT},document:{id:'stmt',details:{moloni_document_id:123,statement_number:'EXT-test'}}}),
      financialPdfResponse:(body,init)=>new Response(body,init),
    },
    '@/lib/moloni/moloni-client':{MoloniClient:class{
      constructor(value){config=value}
      async getDocumentPDFLink(id){assert.equal(id,123);return 'https://fixture.invalid/official.pdf'}
    }},
    fetch:async()=>new Response('%PDF-1.7 fixture'),
  })
  const result=await load('app/api/statements/[id]/moloni-pdf/route.ts').GET({}, {params:Promise.resolve({id:'stmt'})})
  assert.equal(result.status,200);assert.equal(config.refreshToken,'saved-refresh')
  assert.ok(db.queries[0].filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
})

test('direct invoice actions reload the client and prices from server-owned records', async()=>{
 const h=invoiceHarness()
 const result=await h.load('app/actions/moloni.ts').internalEmitInvoice({id:CLIENT,tenant_id:'forged',nif:'forged'},[{id:SHIPMENT,sell_price:0.01}])
 assert.equal(result.success,true)
 const saved=h.db.writes.find(w=>w.kind==='insert'&&w.value.action==='billing_statement').value
 assert.equal(saved.tenant_id,TENANT);assert.equal(saved.details.total_value,3.91)
 assert.ok(h.db.queries.some(q=>q.table==='shipments'&&q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)&&q.filters.some(f=>f.field==='client_id'&&f.value===CLIENT)))
})

test('manual shipment invoices also use the saved client deadline, including same-day payment',async()=>{
 const {addCalendarDays}=createLoader({})('lib/billing/recurring-periods.ts')
 for(const days of [0,10,30]){
  const h=invoiceHarness({clientDueDays:days})
  assert.equal((await h.emit('pending')).success,true)
  assert.equal(h.lastInvoicePayload.paymentDays,days)
  assert.equal(h.lastInvoicePayload.expirationDate,addCalendarDays(h.lastInvoicePayload.date,days))
 }
})

test('Invoice and proforma payloads use the selected payment deadline in Moloni', async()=>{
  for (const method of ['createInvoice','createProFormaInvoice']) {
    const requests=[]
    const h=tokenHarness([connection({access_token:'cached',access_token_expires_at:Date.now()+60000})],async(url,opts)=>{
      const payload=JSON.parse(opts.body);requests.push({url,payload})
      return new Response(JSON.stringify(url.includes('maturityDates/getAll')?[{days:10,maturity_date_id:77}]:{valid:1,document_id:123}))
    })
    await new h.MoloniClient({companyId:'42'})[method]({customerId:1,date:'2026-10-16',expirationDate:'2026-10-26',paymentDays:10,documentSetId:1,products:[]})
    const inserts=requests.filter(r=>r.url.includes('/insert'))
    assert.equal(inserts.length,1)
    assert.equal(inserts[0].payload.maturity_date_id,77)
    assert.equal(inserts[0].payload.expiration_date,'2026-10-26')
  }
})


test('receipts after credit notes use the authoritative Moloni remainder, including VAT, instead of the original TMS total',async()=>{
  const existing=[{id:'credit-statement',tenant_id:TENANT,action:'billing_statement',details:{id:'credit-statement',client_id:CLIENT,moloni_document_id:123,total_value:10}},
    {id:'nc',tenant_id:TENANT,action:'credit_note',details:{client_id:CLIENT,invoice_document_id:123,company_id:'42',state:'issued'}}]
  for(const mode of ['statement','legacy']){
    const h=invoiceHarness({existing:structuredClone(existing),fiscalDocument:{document_id:123,company_id:42,status:1,customer_id:7,net_value:12.3,reconciled_value:2.46}})
    const action=h.load('app/actions/moloni.ts')
    const result=mode==='statement'?await action.emitMoloniReceiptForStatementAction('credit-statement'):await action.emitReceiptAction('credit-statement',CLIENT,123,100)
    assert.equal(result.success,true);assert.equal(h.lastReceiptPayload.value,9.84);assert.equal(h.lastReceiptPayload.customerId,7)
  }
})
test('a credit-note operation awaiting confirmation prevents a new receipt',async()=>{
  const h=invoiceHarness({existing:[{id:'credit-statement',tenant_id:TENANT,action:'billing_statement',details:{id:'credit-statement',client_id:CLIENT,moloni_document_id:123,total_value:10}},
    {id:'nc',tenant_id:TENANT,action:'credit_note',details:{client_id:CLIENT,invoice_document_id:123,company_id:'42',state:'review_required'}}]})
  const result=await h.load('app/actions/moloni.ts').emitMoloniReceiptForStatementAction('credit-statement')
  assert.equal(result.success,false);assert.match(result.error,/nota de crédito em curso/);assert.equal(h.lastReceiptPayload,undefined)
})
