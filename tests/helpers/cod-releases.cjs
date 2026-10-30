const {createHash}=require('node:crypto')
// Explicit authorizations for fixtures that exercise already released money.
function seedCodReleases(tables,tenant,items) {
 for(const item of items) {
  const hash=createHash('sha256').update(`client-cod-payout:${tenant}:${item.clientId}`).digest('hex').slice(0,32)
  const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`
  let row=tables.audit_log.find(row=>row.id===id)
  if(!row){row={id,tenant_id:tenant,action:'client_cod_payout_requests',created_at:'2026-10-30',details:{clientId:item.clientId,revision:'approved-fixture',requests:[],releases:[]}};tables.audit_log.push(row)}
  row.details.releases.push({shipmentId:item.id,tracking:item.tracking,amountCents:item.cents,releasedAt:'2026-10-30',releasedBy:'finance'})
 }
}
module.exports={seedCodReleases}
