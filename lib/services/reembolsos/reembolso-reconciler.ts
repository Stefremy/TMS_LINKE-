import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { loadScopedClientProfiles } from '@/lib/services/clients/scoped-client-profiles'
import { loadCodDeclarations } from './cod-declarations'
import { codCents,reembolsoDay } from './client-cod'
import { billingDay } from '@/lib/billing/statistics'
import type { ReembolsoRawItem,ReembolsoMatchedItem,ClientReembolsoSummary,ReembolsoBatch,ReconcileStatus } from './types'

interface Shipment {id:string;client_id:string|null;tracking_number:string|null;carrier_tracking_number:string|null;status:string;created_at:string}
const normalized=(value:string)=>value.trim().toUpperCase()
export async function reconcileReembolsoItems(rawItems:ReembolsoRawItem[],metadata:{filename:string;carrier:'ctt'|'correos'|string;carrierAccount?:string;carrierContract?:string;destinationIban?:string},tenantId:string):Promise<ReembolsoBatch> {
  if(!tenantId)throw new Error('Company access is missing')
  const db=createAdminClient(),shipments=new Map<string,Shipment>()
  // Only the carrier's actual tracking number can identify a shipment. Old-platform references never assign ownership.
  const tracking=[...new Set(rawItems.map(item=>normalized(item.carrierTracking||'')).filter(Boolean))]
  for(let start=0;start<tracking.length;start+=100)for(const field of ['carrier_tracking_number','tracking_number']) {
    for(let offset=0;;offset+=1000) {
      const {data,error}=await db.from('shipments').select('id,client_id,tracking_number,carrier_tracking_number,status,created_at').eq('tenant_id',tenantId).in(field,tracking.slice(start,start+100))
        .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
      if(error||!data)throw new Error('Não foi possível cruzar as guias com os envios do TMS.')
      for(const row of data)shipments.set(row.id,row as Shipment)
      if(data.length<1000)break
    }
  }
  const byTracking=new Map<string,Map<string,Shipment>>()
  for(const shipment of shipments.values())for(const value of [shipment.tracking_number,shipment.carrier_tracking_number])if(value){const key=normalized(value),group=byTracking.get(key)||new Map<string,Shipment>();group.set(shipment.id,shipment);byTracking.set(key,group)}
  const [clients,declarations]=await Promise.all([
    loadScopedClientProfiles(db,tenantId,[...shipments.values()].map(s=>s.client_id).filter((id):id is string=>Boolean(id))),
    loadCodDeclarations(db,tenantId,[...shipments.values()]),
  ])
  const occurrences=new Map<string,number>()
  for(const item of rawItems){const key=normalized(item.carrierTracking||'');occurrences.set(key,(occurrences.get(key)||0)+1)}
  const items:ReembolsoMatchedItem[]=[],groups=new Map<string,ClientReembolsoSummary>()
  for(const raw of rawItems) {
    const key=normalized(raw.carrierTracking||''),candidates=byTracking.get(key)
    const shipment=candidates?.size===1?[...candidates.values()][0]:undefined
    const client=shipment?.client_id?clients.get(shipment.client_id):undefined
    const declared=shipment?declarations.get(shipment.id):undefined
    const amount=codCents(raw.amount),created=shipment?billingDay(shipment.created_at):null
    const processed=reembolsoDay(raw.processingDate),delivered=reembolsoDay(raw.deliveryDate)
    let status:ReconcileStatus='unmatched',reason='Guia não encontrada neste TMS; pode pertencer à plataforma antiga.'
    if(candidates&&candidates.size>1)reason='Guia repetida em vários envios do TMS. Associação automática bloqueada.'
    else if(shipment&&!client)reason='O envio não tem um cliente registado e confirmado nesta empresa.'
    else if(shipment&&client) {
      status='value_mismatch'
      if(declared?.ownerConflict)reason='A ficha do envio e a cobrança indicam clientes diferentes.'
      else if(['rascunho','draft','cancelado','cancelled','canceled','anulado'].includes(shipment.status.toLowerCase()))reason='O envio está cancelado ou em rascunho.'
      else if(!declared?.enabled||declared.cents===null||declared.cents<=0)reason='Não existe uma cobrança com valor confirmado neste envio do TMS.'
      else if(amount===null||amount<=0||amount!==declared.cents)reason='O valor CTT não coincide com a cobrança registada no envio.'
      else if(!created||!processed||(processed<created)||(delivered!==null&&delivered<created))reason='As datas do extrato não confirmam este envio; pode ser uma guia antiga.'
      else if((occurrences.get(key)||0)>1)reason='A guia aparece mais de uma vez no ficheiro. Reveja antes de disponibilizar valores.'
      else {status='matched';reason='Guia, cliente, cobrança, valor e datas confirmados no TMS.'}
    }
    const assigned=Boolean(shipment&&client),clientId=assigned?shipment!.client_id!:undefined
    const item:ReembolsoMatchedItem={...raw,trackingNotFound:!candidates?.size,reconcileStatus:status,reconcileReason:reason,shipmentId:assigned?shipment!.id:undefined,clientId,
      clientName:assigned?client!.short_name||client!.legal_name||client!.name||'Cliente':'Não associado ao TMS',clientIban:assigned?client!.iban||'Sem IBAN configurado':'',
      expectedCod:declared?.cents&&declared.cents>0?declared.cents/100:undefined,difference:amount!==null&&declared?.cents?((amount-declared.cents)/100):undefined}
    items.push(item)
    const groupKey=clientId||'unmatched_group'
    let group=groups.get(groupKey)
    if(!group){group={clientId:groupKey,clientName:clientId?item.clientName!:'Guias não associadas ao TMS / plataforma antiga',clientIban:item.clientIban||'N/A',clientEmail:client?.billing_email||client?.email||'',totalAmount:0,itemsCount:0,isPaid:false,items:[]};groups.set(groupKey,group)}
    group.items.push(item);group.itemsCount++
    // Neither unknown legacy guides nor divergences become a customer's available balance.
    if(status==='matched')group.totalAmount=Math.round((group.totalAmount+raw.amount)*100)/100
  }
  return{id:randomUUID(),filename:metadata.filename,carrier:metadata.carrier,carrierAccount:metadata.carrierAccount,carrierContract:metadata.carrierContract,destinationIban:metadata.destinationIban,
    reconciliationVersion:2,totalItems:rawItems.length,totalAmount:Math.round(rawItems.reduce((sum,item)=>sum+item.amount,0)*100)/100,
    matchedCount:items.filter(item=>item.reconcileStatus==='matched').length,unmatchedCount:items.filter(item=>item.reconcileStatus==='unmatched').length,
    reviewCount:items.filter(item=>item.reconcileStatus==='value_mismatch').length,items,clientSummaries:[...groups.values()].sort((a,b)=>Number(a.clientId==='unmatched_group')-Number(b.clientId==='unmatched_group')||b.totalAmount-a.totalAmount),created_at:new Date().toISOString()}
}
