const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {isDeliveredStatus}=createLoader({})('lib/status-helpers.ts')
const {canDownloadCttCertificate,hasCttClosure}=createLoader({})('lib/services/ctt/certificate-status.ts')

test('delivered statuses block Devolução and Duplicar, every other status does not',()=>{
 for(const s of ['entregue','Entregue','entregue_pudo','Entregue PUDO','entregue-em-pudo'])assert.equal(isDeliveredStatus(s),true,s)
 for(const s of ['pendente','rascunho','em_transito','em_distribuicao','incidencia','devolvido','cancelado','',null,undefined])assert.equal(isDeliveredStatus(s),false,String(s))
})

test('the acceptance certificate can only be reprinted before the first carrier scan',()=>{
 const closed={id:'a',carrier_code:'ctt',status:'pendente',ops_substatus:'emo',ctt_closed_at:'2026-11-19T15:41:00Z'}
 assert.equal(canDownloadCttCertificate(closed),true)
 for(const status of ['em_transito','em_distribuicao','entregue','incidencia']){
  assert.equal(canDownloadCttCertificate({...closed,status}),false,status)
  assert.equal(hasCttClosure({...closed,status}),true,status)
 }
 assert.equal(canDownloadCttCertificate({...closed,ctt_closed_at:null}),false)
 assert.equal(canDownloadCttCertificate({...closed,carrier_code:'correos'}),false)
})
