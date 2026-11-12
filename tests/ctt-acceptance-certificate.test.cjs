const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const { createLoader } = require('./helpers/load-typescript.cjs'), { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const T='11111111-1111-1111-1111-111111111111', C='22222222-2222-2222-2222-222222222222', A='33333333-3333-3333-3333-333333333333', B='44444444-4444-4444-4444-444444444444'
const PDF=Buffer.from('%PDF-1.7\nORIGINAL CTT CERTIFICATE BYTES').toString('base64')
const doc={FileName:'CertAceitResumo_original.pdf',File:PDF}
const row=(id=A,extra={})=>({id,tenant_id:T,client_id:C,status:'pendente',carrier_code:'ctt',...extra})
const archive=(ids=[A],extra={})=>({tenant_id:T,action:'manifest_closed',details:{shipment_ids:ids,carrier:'ctt_expresso',carrier_documents:[doc],...extra}})
const emission=(id=A,documents=[doc])=>({id:'snapshot-'+id,tenant_id:T,action:'shipment_data',details:{id,ctt_documents:documents}})
function harness(o={}){
 const db=fakeSupabase({shipments:o.rows||[row()],audit_log:o.audit||[]},o.failure),closes=[]
 const load=createLoader({
  '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
  './close-manifest':{closeCttManifest:async(...args)=>{closes.push(args);return o.response||{success:true,count:1,manifestPdfBase64:PDF,documents:[doc]}}},
  '@/lib/auth/context':{requireUser:async permission=>{assert.equal(permission,'Emissão e Controlo de Guias CTT');if(o.denied)throw Error('ACCESS_DENIED');return {tenant_id:T,role:'client',client_id:o.missingClient?null:C}}},
 })
 return {db,closes,get:load('lib/services/ctt/acceptance-certificate.ts').getCttAcceptanceCertificate,action:load('app/actions/shipment-manifests.ts').generateCttAcceptanceCertificateAction,download:load('app/actions/shipment-manifests.ts').downloadCttAcceptanceCertificateAction}
}

test('exact archived batch returns every original certificate byte-for-byte without another CTT close',async()=>{
 const docs=[doc,{FileName:'CertAceitResumo_2.pdf',File:Buffer.from('%PDF-1.4\nSECOND ORIGINAL').toString('base64')}]
 const h=harness({audit:[archive([A],{carrier_documents:docs})]})
 const r=await h.action([A]);assert.equal(r.success,true);assert.equal(r.manifestPdfBase64,PDF);assert.deepEqual(r.documents,docs)
 assert.equal(h.closes.length,0);assert.equal(h.db.writes.filter(w=>w.table==='shipments')[0].value.ops_substatus,'manifesto_fechado')
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===T)))
 assert.ok(h.db.queries[0].filters.some(f=>f.field==='client_id'&&f.value===C))
})

test('original certificates saved during CompleteShipment prevent the already-closed error and exclude labels or other document types',async()=>{
 const h=harness({audit:[emission(A,[{FileName:'label.pdf',File:PDF},{FileName:'certificado_origem.pdf',File:PDF},doc])]})
 const r=await h.action([A]);assert.equal(r.success,true);assert.deepEqual(r.documents,[doc]);assert.equal(h.closes.length,0)
 const labels=harness({audit:[emission(A,[{FileName:'label.pdf',File:PDF},{FileName:'certificado_origem.pdf',File:PDF}])]})
 await labels.action([A]);assert.equal(labels.closes.length,1)
})

test('unclosed CTT shipments use the existing scoped carrier close, never a generated substitute PDF',async()=>{
 const h=harness();const r=await h.action([A]);assert.equal(r.manifestPdfBase64,PDF);assert.deepEqual(h.closes,[[T,[A],C]])
 const refused=harness({response:{success:false,count:0,error:'Shipment of object number FIXTURE not found or already closed.'}})
 const fail=await refused.action([A]);assert.equal(fail.success,false);assert.equal(fail.manifestPdfBase64,undefined);assert.match(fail.error,/Não foi obtido um certificado oficial/)
 const missing=harness({response:{success:true,count:1,warning:'CTT did not return a PDF'}})
 assert.equal((await missing.action([A])).manifestPdfBase64,undefined)
})

test('Correos, mixed carriers, drafts and cancelled shipments cannot access or generate CTT certificates',async()=>{
 for(const extra of [{carrier_code:'correos'},{carrier_code:'correos_express'},{status:'rascunho'},{status:'cancelado'}]){
  const h=harness({rows:[row(A,extra)],audit:[archive()]});assert.equal((await h.action([A])).success,false);assert.equal(h.closes.length,0)
 }
 const h=harness({rows:[row(),row(B,{carrier_code:'correos'})]});assert.equal((await h.action([A,B])).success,false);assert.equal(h.closes.length,0)
})

test('foreign accounts, companies, invalid selections and denied permissions cannot expose a certificate or call CTT',async()=>{
 for(const extra of [{client_id:B},{tenant_id:B}]){
  const h=harness({rows:[row(A,extra)],audit:[archive()]});assert.equal((await h.action([A])).success,false);assert.equal(h.closes.length,0)
 }
 for(const ids of [[],undefined,['invalid'],Array(101).fill(A)]){
  const h=harness();assert.equal((await h.action(ids)).success,false);assert.equal(h.db.queries.length,0)
 }
 const denied=harness({denied:true});await assert.rejects(denied.action([A]),/ACCESS_DENIED/);assert.equal(denied.db.queries.length,0)
 const missing=harness({missingClient:true});assert.equal((await missing.action([A])).success,false);assert.equal(missing.db.queries.length,0)
})

test('a certificate for a larger or foreign batch is never exposed or closed a second time',async()=>{
 const h=harness({audit:[archive([A,B])]})
 const r=await h.action([A]);assert.equal(r.success,false);assert.equal(r.documents,undefined);assert.equal(h.closes.length,0)
 const foreign=harness({audit:[{...archive(),tenant_id:B}]});await foreign.action([A]);assert.equal(foreign.closes.length,1)
})

test('closed batches with missing or corrupt PDFs and partial saved certificates cannot cause another close',async()=>{
 for(const audit of [[archive([A],{carrier_documents:[]})],[archive([A],{carrier_documents:[{FileName:'bad.pdf',File:'bm90LXBkZg=='}]})]]){
  const h=harness({audit});assert.equal((await h.action([A])).success,false);assert.equal(h.closes.length,0)
 }
 const partial=harness({rows:[row(),row(B)],audit:[emission(A)]});assert.equal((await partial.action([A,B])).success,false);assert.equal(partial.closes.length,0)
 const closed=harness({rows:[row(A,{ops_substatus:'manifesto_fechado'})]});assert.equal((await closed.action([A])).success,false);assert.equal(closed.closes.length,0)
})

test('failed certificate lookups do not dispatch a potentially duplicate carrier close',async()=>{
 for(const table of ['shipments','audit_log']){
  const h=harness({failure:q=>q.table===table?{message:'Fixture failure'}:null});assert.equal((await h.action([A])).success,false);assert.equal(h.closes.length,0)
 }
})

test('client dashboard and history expose only CTT certificate controls and use the official document action',()=>{
 for(const file of ['app/app/components/ClientDashboard.tsx','app/app/components/ClientShipmentsHistory.tsx']){
  const source=fs.readFileSync(file,'utf8')
  const bulk=file.endsWith('ClientShipmentsHistory.tsx')
  assert.match(source,bulk?/CttCertificateStatus/:/Certificado de aceitação gerado/)
  assert.match(source,/generateCttAcceptanceCertificateAction\(manifestIds\)/)
  assert.match(source,/Documento oficial CTT/)
  // Bulk closing lives in the history; the overview closes one shipment at a time.
  for(const control of [/CttCertificateCheckbox/,/CttCertificateToolbar/]) bulk?assert.match(source,control):assert.doesNotMatch(source,control)
  if(!bulk) assert.match(source,/void handleGenerateManifest\(shipment\.id\)/)
  assert.doesNotMatch(source,/generateHandoverManifest|Manifesto pronto para assinatura/)
 }
})


test('reprinting a row returns its complete own-store batch and never closes shipments',async()=>{
 const h=harness({rows:[row(),row(B)],audit:[archive([A,B])]})
 const r=await h.download(A);assert.equal(r.success,true);assert.equal(r.count,2);assert.deepEqual(r.shipmentIds,[A,B]);assert.equal(r.manifestPdfBase64,PDF)
 assert.equal(h.closes.length,0);assert.equal(h.db.writes.length,0)
 const foreign=harness({rows:[row(),row(B,{client_id:B})],audit:[archive([A,B])]})
 assert.equal((await foreign.download(A)).success,false);assert.equal(foreign.closes.length,0)
 const notClosed=harness();assert.equal((await notClosed.download(A)).success,false);assert.equal(notClosed.closes.length,0)
})
