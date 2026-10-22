import type {SupabaseClient} from '@supabase/supabase-js'
import type {CreditNote,InvoiceKind} from './types'

export async function loadInvoiceCredits(db:SupabaseClient,tenantId:string,clientId?:string) {
  const notes:CreditNote[]=[]
  for(let offset=0;;offset+=1000) {
    let q=db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','credit_note')
    if(clientId)q=q.eq('details->>client_id',clientId)
    const {data,error}=await q.order('created_at',{ascending:false}).order('id').range(offset,offset+999)
    if(error)throw new Error('Não foi possível confirmar as notas de crédito associadas.')
    notes.push(...(data||[]).map(row=>row.details as CreditNote))
    if(!data||data.length<1000)return notes
  }
}
export function invoiceCreditSummary(invoice:{audit_id?:string;id?:string;client_id?:string;moloni_document_id?:unknown;total_value?:unknown;status?:string;moloni_receipt_id?:unknown;moloni_receipt_pdf?:unknown},kind:InvoiceKind,notes:CreditNote[]) {
  const related=notes.filter(n=>n.source.kind===kind && n.source.id===(invoice.audit_id||invoice.id) && n.client_id===invoice.client_id && n.invoice_document_id===Number(invoice.moloni_document_id))
  const issued=related.filter(n=>n.state==='issued')
  const cents=(key:'net'|'total')=>issued.reduce((sum,n)=>{
    const v=n[key];if(v==null||!Number.isFinite(v)||v<0)throw new Error('Nota de crédito sem total confirmado.')
    return sum+Math.round(v*100)
  },0)
  const net=cents('net'),total=cents('total'),original=Math.round(Number(invoice.total_value||0)*100)
  const deduction=kind==='billing_statement'?net:total
  if(deduction>original+1)throw new Error('As notas de crédito excedem o valor original da fatura. Confirme os documentos no Moloni.')
  return {credited_net:net/100,credited_total:total/100,credit_pending:related.some(n=>!['issued','cancelled'].includes(n.state)),
    outstanding_value:invoice.status==='paid'||invoice.moloni_receipt_id||invoice.moloni_receipt_pdf?0:Math.max(0,original-deduction)/100,
    credit_notes:issued.map(n=>({id:n.id,number:n.number,total:n.total}))}
}
