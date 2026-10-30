import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { codCents } from './client-cod'

export interface CodDeclaration { cents:number|null; enabled:boolean; ownerConflict:boolean }
export async function loadCodDeclarations(db:SupabaseClient,tenant:string,shipments:{id:string;client_id:string|null}[]) {
  const result=new Map<string,CodDeclaration>()
  for(let start=0;start<shipments.length;start+=100) {
    const part=shipments.slice(start,start+100),owned=new Map(part.map(s=>[s.id,s])),seen=new Set<string>()
    for(let offset=0;;offset+=1000) {
      const {data,error}=await db.from('audit_log').select('id,created_at,shipmentId:details->>id,clientId:details->>client_id,codValue:details->cod_value,codAmount:details->cod_amount,isCod:details->is_cod')
        .eq('tenant_id',tenant).eq('action','shipment_data').in('details->>id',part.map(s=>s.id)).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
      if(error||!data)throw new Error('Não foi possível consultar as cobranças registadas no TMS.')
      for(const row of data) {
        if(typeof row.shipmentId!=='string'||seen.has(row.shipmentId)||!owned.has(row.shipmentId))continue
        seen.add(row.shipmentId)
        const ownerConflict=Boolean(row.clientId&&row.clientId!==owned.get(row.shipmentId)!.client_id)
        const cents=row.isCod===false?0:codCents(row.codValue??row.codAmount)
        result.set(row.shipmentId,{cents:ownerConflict?null:cents,enabled:!ownerConflict&&(row.isCod===true||(cents!==null&&cents>0)),ownerConflict})
      }
      if(data.length<1000)break
    }
  }
  return result
}
