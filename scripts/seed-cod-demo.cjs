// Synthetic COD workflow data only. Never calls a carrier, invoice, email or pickup API.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {createClient}=require('@supabase/supabase-js')
const {createLoader}=require('../tests/helpers/load-typescript.cjs')
const TENANT='11111111-1111-1111-1111-111111111111',DAY='2026-10-30',CREATED='2026-10-30T09:00:00.000Z'
const NAME='TESTES REEMBOLSOS — NÃO EXPEDIR',SLUG='testes-reembolsos',TAG='cod-demo-2026-10-30'
const id=key=>{const h=crypto.createHash('sha256').update(`${TENANT}:cod-demo:${DAY}:${key}`).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
const clientId=id('client'),csvPath=path.resolve('public/patches/reembolsos-teste-2026-10-30.csv'),out=path.resolve('docs/imports/cod-demo-2026-10-30')
const specs=[
 {n:1,cod:50,status:'entregue',file:50,note:'Correspondência válida'},
 {n:2,cod:25,status:'entregue',file:25,note:'Correspondência válida'},
 {n:3,cod:18.5,status:'entregue',file:18.5,note:'Correspondência válida'},
 {n:4,cod:40,status:'entregue',file:39.99,note:'Valor divergente: TMS 40,00 / ficheiro 39,99'},
 {n:5,cod:0,status:'entregue',file:12,note:'Não tem cobrança no TMS'},
 {n:6,cod:30,status:'recolhido',note:'Em trânsito; fora do ficheiro'},
 {n:7,cod:15,status:'cancelado',file:15,note:'Envio cancelado'},
 {n:8,cod:20,status:'entregue',note:'Aguarda extrato; fora do ficheiro'},
].map(s=>({...s,id:id(`shipment-${s.n}`),tracking:`ZZ${830100000+s.n}ZZ`,reference:`TEST-COD-20261030-${String(s.n).padStart(2,'0')}`}))
function csv(){
 const rows=[['Número de Linha','Objeto','Data Entrega','Data Processamento','Destinatário','Morada','Código Postal','Localidade','Valor','Pagamento','Referência','Informação','Notas']]
 for(const s of specs.filter(s=>s.file!==undefined))rows.push([rows.length,s.tracking,'30/10/2026','30/10/2026',`Destinatário fictício ${s.n}`,'Rua de Teste 1','4800-019','Guimarães',s.file.toFixed(2).replace('.',','),'D',s.reference,'TESTE FICTÍCIO',s.note])
 rows.push([rows.length,'ZZ830100999ZZ','30/10/2026','30/10/2026','Destinatário fictício sem guia','Rua de Teste 1','4800-019','Guimarães','9,99','D','TEST-COD-INEXISTENTE','TESTE FICTÍCIO','Tracking inexistente no TMS'])
 return rows.map(row=>row.join(';')).join('\r\n')+'\r\n'
}
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const load=createLoader({'node:crypto':crypto,'fast-xml-parser':require('fast-xml-parser'),'@/lib/supabase/server':{createAdminClient:()=>db}})
 const content=csv(),parsed=load('lib/services/reembolsos/ctt-reembolso-parser.ts').parseCttReembolsoFile(content)
 if(parsed.items.length!==7||Math.round(parsed.totalAmount*100)!==17048)throw Error('Ficheiro de teste inválido.')
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({clientId,name:NAME,shipments:specs.length,csvRows:parsed.items.length,expectedAvailable:93.5,expectedDivergences:4,apply:false}));return}
 fs.mkdirSync(out,{recursive:true})
 const manifest={tag:TAG,tenant:TENANT,clientId,portalSlug:SLUG,shipments:specs,csv:csvPath,createdAt:new Date().toISOString()}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600})
 const check=async query=>{const result=await query;if(result.error)throw Error(result.error.message);return result.data}
 const existing=await check(db.from('clients').select('id,name').eq('tenant_id',TENANT).eq('id',clientId).maybeSingle())
 if(existing&&existing.name!==NAME)throw Error('O identificador já pertence a outra ficha; nada foi alterado.')
 if(!existing){
  await check(db.from('clients').insert({id:clientId,tenant_id:TENANT,name:NAME}))
  const profile={id:clientId,code:'TEST-COD',portal_slug:SLUG,short_name:NAME,legal_name:NAME,nif:'',color:'#697078',category:'Cliente Pré-Pagamento',billing_type:'pay_as_you_go',pay_as_you_go_since:CREATED,address:'Rua de Teste 1',postal_code:'4800-019',city:'Guimarães',country_code:'PT',billing_same_as_pickup:true,email:'',billing_email:'',phone:'',manager_name:'Conta fictícia de testes',billing_agency:'A01 - Sede Guimarães',payment_terms:'Por definir',iban:'',credit_limit:0,credit_limit_enabled:false,balance:'0,00€',is_active:true,created_at:CREATED,assigned_linke_service_ids:[],allowed_webservices:[],observations:'TESTE FICTÍCIO DE REEMBOLSOS. Não expedir, faturar ou transferir dinheiro. Portes de teste a zero. Usar apenas para simulação do cruzamento CTT.',test_fixture:TAG}
  await check(db.rpc('save_client_financial_profile',{p_tenant:TENANT,p_client:clientId,p_details:profile,p_expected_credit:null}))
  await check(db.from('audit_log').insert({id:id('portal-access'),tenant_id:TENANT,action:'client_portal_access',details:{id:clientId,suspended:true,blocked:false,reason:'Conta fictícia: impedir criação de guias reais.',test_fixture:TAG}}))
 }
 for(const s of specs){
  const prior=await check(db.from('shipments').select('id,client_id,tracking_number').eq('tenant_id',TENANT).eq('id',s.id).maybeSingle())
  if(prior){if(prior.client_id!==clientId||prior.tracking_number!==s.reference)throw Error('Conflito com envio existente.');continue}
  const row={id:s.id,tenant_id:TENANT,client_id:clientId,tracking_number:s.reference,carrier_tracking_number:s.tracking,carrier_code:'test',status:s.status,service_type:'TESTE FICTÍCIO COD — NÃO EXPEDIR',sender_name:NAME,sender_address:'Rua de Teste 1',sender_zip4:'4800',sender_zip3:'019',recipient_name:`Destinatário fictício ${s.n}`,recipient_address:'Rua de Teste 1',recipient_zip4:'4800',recipient_zip3:'019',recipient_email:'',recipient_phone:'',buy_price:0,sell_price:0,created_at:CREATED,updated_at:CREATED}
  const snapshot={...row,reference:s.reference,test_fixture:TAG,is_cod:s.cod>0,cod_value:s.cod,cod_amount:s.cod,observations:`TESTE FICTÍCIO — NÃO EXPEDIR. ${s.note}`,recipient:{name:row.recipient_name,address:row.recipient_address,city:'Guimarães',zip:'4800-019',country:'PT'},sender:{name:NAME,address:row.sender_address,city:'Guimarães',zip:'4800-019',country:'PT'},weight_kg:1,volumes_count:1,dimensions:{length:10,width:10,height:10},ctt_label_base64:null}
  await check(db.from('shipments').insert(row))
  await check(db.from('audit_log').insert({id:id(`snapshot-${s.n}`),tenant_id:TENANT,action:'shipment_data',details:snapshot,created_at:CREATED}))
 }
 fs.mkdirSync(path.dirname(csvPath),{recursive:true});fs.writeFileSync(csvPath,'\ufeff'+content,'utf8')
 // Read-only proof: calculate the prospective import without saving a reimbursement batch or request.
 const preview=await load('lib/services/reembolsos/reembolso-reconciler.ts').reconcileReembolsoItems(parsed.items,{filename:path.basename(csvPath),carrier:'ctt'},TENANT)
 const current=await load('lib/services/reembolsos/client-cod-payout.ts').loadClientCodPage(db,TENANT,clientId)
 if(preview.matchedCount!==3||preview.reviewCount!==3||preview.unmatchedCount!==1||Math.round(preview.clientSummaries.find(c=>c.clientId===clientId)?.totalAmount*100)!==9350||current.payout.availableCents!==0)throw Error('Os resultados dos testes não correspondem ao plano. Consulte o manifesto.')
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({clientId,shipmentCount:specs.length,preview:{matched:preview.matchedCount,review:preview.reviewCount,unmatched:preview.unmatchedCount,availableAfterImport:93.5},currentAvailable:current.payout.availableCents,batchSaved:false,requestsCreated:false},null,2),{mode:0o600})
 console.log(JSON.stringify({clientId,name:NAME,shipments:specs.length,portalPath:`/app/${SLUG}/reembolsos`,csv:csvPath,previewMatched:preview.matchedCount,previewDivergences:preview.reviewCount+preview.unmatchedCount,availableAfterImport:93.5,batchSaved:false,requestsCreated:false}))
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
