import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadOpsCodClients, type OpsCodClient } from './ops-cod-data'
import { loadCodDeclarations } from './cod-declarations'
import { codSettlementFromItem } from './client-cod-data'
import { applyCodPayoutRecords, buildClientCodRows, clientCodReceivable, deliveredClientCodRows, type CodPayoutBox, type CodSettlement, type CodShipment, type ClientCodRow } from './client-cod'
import { parseCodPayoutBox, payoutBoxId } from './client-cod-payout'

export interface OpsCodWorkflowRow extends ClientCodRow { clientId:string; clientName:string; clientCode:string; delivered:boolean; requested:boolean }
export interface OpsCodWorkflowRequest { id:string; clientId:string; clientName:string; clientCode:string; createdAt:string; amountCents:number; tracking:string[]; state:'requested'|'paid'|'review'; paidAt?:string; paymentRef?:string }
export interface OpsCodWorkflowClient extends OpsCodClient { availableCents:number; pendingCents:number; paidCents:number; availableIds:string[] }
export interface OpsCodMissingGuide { tracking:string; amountCents:number; filename:string; lineNumber:number }
export interface OpsCodWorkflowData { rows:OpsCodWorkflowRow[]; clients:OpsCodWorkflowClient[]; requests:OpsCodWorkflowRequest[]; missing:OpsCodMissingGuide[] }
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}

/** Bulk OPS reader. It shares the portal's ownership, statement and payout rules without one query per store. */
export async function loadOpsCodWorkflow(db:SupabaseClient,tenant:string):Promise<OpsCodWorkflowData> {
  if(!tenant) throw new Error('Empresa não identificada.')
  const clients=await loadOpsCodClients(db,tenant),byClient=new Map(clients.map(c=>[c.id,c]))
  const shipments:(CodShipment & {client_id:string;tenant_id:string})[]=[]
  const knownTracking=new Set<string>()
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('shipments').select('id,tenant_id,client_id,tracking_number,carrier_tracking_number,carrier_code,status,created_at').eq('tenant_id',tenant).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
    if(error||!data) throw new Error('Não foi possível carregar as cobranças.')
    for(const item of data) if(item.tenant_id===tenant) {
      for(const value of [item.tracking_number,item.carrier_tracking_number]) if(typeof value==='string'&&value.trim()) knownTracking.add(value.trim().toUpperCase())
      if(byClient.has(item.client_id)) shipments.push(item)
    }
    if(data.length<1000) break
  }
  const declarations=await loadCodDeclarations(db,tenant,shipments)
  for(const item of shipments) {
    const declaration=declarations.get(item.id)
    if(declaration?.ownerConflict) throw new Error('Uma cobrança tem associação de cliente divergente. Reveja a ficha do envio.')
    item.cod_enabled=declaration?.enabled
    item.cod_value=declaration?.cents!==null&&declaration?.cents!==undefined?declaration.cents/100:null
  }
  const owned=new Map(shipments.map(s=>[s.id,s])),settlements=new Map<string,CodSettlement[]>(),boxes=new Map<string,CodPayoutBox>(),missing:OpsCodMissingGuide[]=[]
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('audit_log').select('id,action,details').eq('tenant_id',tenant).in('action',['reembolso_batch','client_cod_payout_requests']).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
    if(error||!data) throw new Error('Não foi possível carregar cruzamentos e pagamentos.')
    for(const row of data) {
      const details=record(row.details)
      if(row.action==='client_cod_payout_requests') {
        const id=typeof details.clientId==='string'?details.clientId:''
        if(!byClient.has(id)) continue
        if(row.id!==payoutBoxId(tenant,id)||boxes.has(id)) throw new Error('Pedido com associação inválida.')
        boxes.set(id,parseCodPayoutBox(details,id));continue
      }
      if(!Array.isArray(details.clientSummaries)) throw new Error('Extrato incompleto. Verifique o ficheiro importado.')
      for(const rawSummary of details.clientSummaries) {
        const summary=record(rawSummary),id=typeof summary.clientId==='string'?summary.clientId:''
        if(!byClient.has(id)) continue
        if(!Array.isArray(summary.items)) throw new Error('Extrato incompleto.')
        for(const rawItem of summary.items) {
          const item=record(rawItem),shipment=typeof item.shipmentId==='string'?owned.get(item.shipmentId):undefined
          if(!shipment||shipment.client_id!==id||(item.clientId&&item.clientId!==id)) continue
          const values=settlements.get(id)||[]
          values.push(codSettlementFromItem(details.carrier,summary,item,shipment));settlements.set(id,values)
        }
      }
      if(Array.isArray(details.items)) for(const rawItem of details.items) {
        const item=record(rawItem)
        const tracking=typeof item.carrierTracking==='string'?item.carrierTracking.trim():''
        if(!tracking||!knownTracking.has(tracking.toUpperCase())) missing.push({tracking:tracking||'Sem tracking',amountCents:typeof item.amount==='number'&&Number.isFinite(item.amount)?Math.round(item.amount*100):0,filename:typeof details.filename==='string'?details.filename:'Extrato',lineNumber:typeof item.lineNumber==='number'?item.lineNumber:0})
      }
    }
    if(data.length<1000) break
  }
  const result:OpsCodWorkflowData={rows:[],clients:[],requests:[],missing}
  const grouped=new Map<string,CodShipment[]>()
  for(const s of shipments){const items=grouped.get(s.client_id)||[];items.push(s);grouped.set(s.client_id,items)}
  for(const client of clients) {
    const overview={clientId:client.id,rows:buildClientCodRows(grouped.get(client.id)||[],settlements.get(client.id)||[]),updatedAt:new Date().toISOString()},box=boxes.get(client.id)||null
    const rows=applyCodPayoutRecords(overview,box).rows,payout=clientCodReceivable(overview,box),delivered=new Set(deliveredClientCodRows(rows).map(r=>r.id)),claimed=new Set(box?.requests.flatMap(r=>r.shipmentIds)||[])
    result.clients.push({...client,availableCents:payout.availableCents,pendingCents:payout.pendingCents,paidCents:rows.filter(r=>r.state==='paid').reduce((sum,r)=>sum+(r.requestedCents||0),0),availableIds:payout.eligible.map(r=>r.id)})
    result.rows.push(...rows.map(r=>({...r,clientId:client.id,clientName:client.name,clientCode:client.code,delivered:delivered.has(r.id),requested:claimed.has(r.id)})))
    result.requests.push(...payout.history.map(r=>({...r,clientId:client.id,clientName:client.name,clientCode:client.code,tracking:r.shipmentIds.map(id=>rows.find(row=>row.id===id)?.tracking||id)})))
  }
  result.requests.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  return result
}
