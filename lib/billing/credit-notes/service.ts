import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import { MoloniClient } from '@/lib/moloni/moloni-client'
import { CreditNoteError, amount, positiveId, record, availableCreditLines, selectedCreditProducts } from './products'
import type { CreditNote, CreditSource, CreditSelection, CreditState } from './types'
import { lisbonDate } from '@/lib/billing/recurring-periods'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const lockId=(tenant:string,company:string,document:number)=>{
  const h=createHash('sha256').update(`credit-note:${tenant}:${company}:${document}`).digest('hex').slice(0,32)
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}
export async function creditMoloni(db:SupabaseClient,tenantId:string,companyId?:string) {
  let q=db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','moloni_connection_config')
  if (companyId) q=q.eq('details->>company_id',companyId)
  const {data,error}=await q.order('created_at',{ascending:false}).limit(1).maybeSingle()
  if (error) throw new CreditNoteError('Não foi possível consultar a ligação Moloni.')
  const company=companyId || String(data?.details?.company_id || process.env.MOLONI_COMPANY_ID || '')
  const refresh=data?.details?.refresh_token || (company===process.env.MOLONI_COMPANY_ID ? process.env.MOLONI_REFRESH_TOKEN : undefined)
  if (!company || !refresh) throw new CreditNoteError('Ligue a conta Moloni desta empresa antes de continuar.')
  return {company, moloni:new MoloniClient({tenantId,companyId:company,refreshToken:refresh})}
}
export async function creditSource(db:SupabaseClient,tenantId:string,source:CreditSource) {
  if (!source || !uuid.test(source.id) || !['billing_statement','custom_invoice'].includes(source.kind)) throw new CreditNoteError('Fatura inválida.')
  let found:Record<string,unknown>|null=null
  for (const field of ['id','details->>id']) {
    const {data,error}=await db.from('audit_log').select('id,details').eq('tenant_id',tenantId).eq('action',source.kind)
      .eq(field,source.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if (error) throw new CreditNoteError('Não foi possível consultar a fatura.')
    if (data) {found=data;break}
  }
  if (!found) throw new CreditNoteError('Fatura não encontrada nesta empresa.')
  const details=record(found.details)
  if (!details.client_id || details.is_pro_forma || !details.moloni_document_id) throw new CreditNoteError('Selecione uma fatura oficial associada a um cliente.')
  if (details.moloni_receipt_id || details.moloni_receipt_pdf || details.status === 'paid') {
    throw new CreditNoteError('Não é possível emitir nota de crédito para uma fatura com recibo já emitido.')
  }
  const {data:client,error}=await db.from('clients').select('id').eq('tenant_id',tenantId).eq('id',details.client_id).maybeSingle()
  if (error || !client) throw new CreditNoteError('Cliente da fatura não encontrado nesta empresa.')
  return {details,source:{id:String(found.id),kind:source.kind},documentId:positiveId(details.moloni_document_id)}
}
async function creditInvoiceDocument(db:SupabaseClient,tenantId:string,source:CreditSource) {
  const original=await creditSource(db,tenantId,source)
  const {company,moloni}=await creditMoloni(db,tenantId,original.details.moloni_company_id ? String(original.details.moloni_company_id):undefined)
  const invoice=record(await moloni.request('documents/getOne',{document_id:original.documentId}))
  if (positiveId(invoice.document_id)!==original.documentId || String(invoice.company_id)!==company || Number(invoice.status)!==1) throw new CreditNoteError('A fatura não está fechada nesta empresa Moloni.')
  const type=String(record(invoice.document_type).saft_code)
  if (type === 'FR') throw new CreditNoteError('Não é possível emitir nota de crédito sobre uma Fatura-Recibo.')
  if (type === 'RC') throw new CreditNoteError('Não é possível emitir nota de crédito sobre um recibo.')
  if (!['FT','FS'].includes(type)) throw new CreditNoteError('Apenas faturas oficiais (FT) podem ser creditadas.')
  if (Number(invoice.exchange_currency_id || 0) || Number(invoice.financial_discount || 0) || Number(invoice.special_discount || 0) || Number(invoice.deduction_value || 0)) throw new CreditNoteError('Esta fatura tem moeda, retenções ou descontos globais que exigem tratamento no Moloni.')
  const gross=amount(invoice.net_value),tax=amount(invoice.taxes_value)
  const expected=original.source.kind==='custom_invoice' ? amount(original.details.total_value) : amount(original.details.total_value)+tax
  if (Math.abs(Math.round(gross*100)-Math.round(expected*100))>1) throw new CreditNoteError('Os valores da fatura Moloni não correspondem ao documento TMS. Confirme a associação antes de creditar.')
  if (invoice.reconciled_value != null) {
    const reconciled = amount(invoice.reconciled_value)
    if (Math.round((gross - reconciled) * 100) <= 0) {
      throw new CreditNoteError('Esta fatura já se encontra liquidada ou totalmente creditada no Moloni.')
    }
  }
  return {...original,company,moloni,invoice,type}
}
export async function creditInvoice(db:SupabaseClient,tenantId:string,source:CreditSource) {
  const info=await creditInvoiceDocument(db,tenantId,source)
  const available=await info.moloni.request('documents/getUnrelatedProducts',{document_id:info.documentId})
  return {...info,lines:availableCreditLines(info.invoice,available)}
}
export async function readCreditNote(db:SupabaseClient,tenantId:string,id:string) {
  if (!uuid.test(id)) throw new CreditNoteError('Nota de crédito inválida.')
  const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','credit_note').eq('id',id).maybeSingle()
  if (error || !data) throw new CreditNoteError('Nota de crédito não encontrada nesta empresa.')
  return data.details as CreditNote
}
async function saveNote(db:SupabaseClient,tenantId:string,old:CreditNote,note:CreditNote) {
  const {data,error}=await db.from('audit_log').update({details:note}).eq('tenant_id',tenantId).eq('action','credit_note')
    .eq('id',note.id).eq('details->>state',old.state).select('id').maybeSingle()
  if (error || !data) throw new CreditNoteError('A operação mudou ou não foi possível guardar o estado. Consulte Notas de Crédito antes de repetir.')
  return note
}
async function release(db:SupabaseClient,tenantId:string,note:CreditNote) {
  const {error}=await db.from('audit_log').delete().eq('tenant_id',tenantId).eq('action','credit_note_lock')
    .eq('id',lockId(tenantId,note.company_id,note.invoice_document_id)).eq('details->>operation_id',note.id)
  if (error) throw new CreditNoteError('Documento guardado. Não foi possível libertar a operação; consulte a equipa de suporte.')
}
function cleanNote(note:CreditNote) {
  // Auth tokens, provider payloads and invoice-wide data never enter a client DTO.
  return {id:note.id,client_id:note.client_id,client_name:note.client_name,source:note.source,
    invoice_number:note.invoice_number,invoice_document_id:note.invoice_document_id,company_id:note.company_id,
    customer_id:note.customer_id,state:note.state,reason:note.reason,date:note.date,created_at:note.created_at,
    document_id:note.document_id,number:note.number,net:note.net,tax:note.tax,total:note.total,
    error:note.error,phase:note.phase,lines:note.lines}
}
export type CreditNoteDto=ReturnType<typeof cleanNote>
export {cleanNote as creditNoteDto}
export async function prepareCredit(db:SupabaseClient,ctx:AuthContext,source:CreditSource,id:string,selections:CreditSelection[],reason:string) {
  if (!uuid.test(id) || typeof reason!=='string' || reason.trim().length<5 || reason.length>1000) throw new CreditNoteError('Indique um motivo de 5 a 1000 caracteres.')
  const {data:prior,error:priorError}=await db.from('audit_log').select('details').eq('tenant_id',ctx.tenant_id).eq('action','credit_note').eq('id',id).maybeSingle()
  if (priorError) throw new CreditNoteError('Não foi possível verificar a tentativa anterior.')
  if (prior) {
    const note=prior.details as CreditNote
    const bound=await creditSource(db,ctx.tenant_id,source)
    if (note.source.id!==bound.source.id || note.source.kind!==bound.source.kind) throw new CreditNoteError('Pedido já utilizado noutra fatura.')
    return cleanNote(note)
  }
  const info=await creditInvoice(db,ctx.tenant_id,source)
  const products=selectedCreditProducts(info.lines,selections,info.documentId)
  if (!products.length) throw new CreditNoteError('A fatura não tem linhas disponíveis para crédito.')
  const series=positiveId(info.invoice.document_set_id),customer=positiveId(info.invoice.customer_id)
  const reference=`TMS-NC-${id}`
  const payload={date:lisbonDate(),document_set_id:series,customer_id:customer,status:0,our_reference:reference,
    associated_documents:[{associated_id:info.documentId,value:info.type==='FT'?amount(info.invoice.net_value):0}],
    notes:reason.trim(),products}
  let note:CreditNote={id,source:info.source,client_id:String(info.details.client_id),client_name:String(info.details.client_name || info.invoice.entity_name || 'Cliente'),
    invoice_number:String(info.details.moloni_document_number || info.details.invoice_number || info.details.statement_number || info.documentId),
    invoice_document_id:info.documentId,company_id:info.company,customer_id:customer,state:'preparing',reason:reason.trim(),
    date:lisbonDate(),created_at:new Date().toISOString(),created_by:ctx.user.id,reference,payload,lines:products.map(p=>({name:p.name,qty:p.qty,price:p.price}))}
  const {error:claimError}=await db.from('audit_log').insert({id:lockId(ctx.tenant_id,info.company,info.documentId),tenant_id:ctx.tenant_id,action:'credit_note_lock',
    details:{operation_id:id,invoice_document_id:info.documentId,client_id:note.client_id}})
  if (claimError) throw new CreditNoteError('Esta fatura tem uma nota de crédito em preparação ou por confirmar. Consulte Notas de Crédito antes de repetir.')
  const {error:writeError}=await db.from('audit_log').insert({id,tenant_id:ctx.tenant_id,action:'credit_note',details:note})
  if (writeError) {await release(db,ctx.tenant_id,note);throw new CreditNoteError('Não foi possível guardar a preparação. Nenhum pedido de criação foi enviado ao Moloni.')}
  note=await saveNote(db,ctx.tenant_id,note,{...note,state:'creating',phase:'create'})
  try {
    const result=record(await info.moloni.request('creditNotes/insert',payload))
    const docId=positiveId(result.document_id)
    // Persist the returned ID before any subsequent read/PDF call can fail.
    note=await saveNote(db,ctx.tenant_id,note,{...note,document_id:docId})
    return cleanNote(await refreshCredit(db,ctx.tenant_id,note))
  } catch {
    const review={...note,state:'review_required' as const,error:'Não foi possível confirmar a preparação. Consulte o Moloni; não repita a criação.'}
    try {await saveNote(db,ctx.tenant_id,note,review)} catch { /* The durable creating state also blocks retries. */ }
    return cleanNote(review)
  }
}
function validateCreditDocument(note:CreditNote,document:Record<string,unknown>) {
  if (positiveId(document.document_id)!==note.document_id || String(document.company_id)!==note.company_id || positiveId(document.customer_id)!==note.customer_id
    || String(record(document.document_type).saft_code)!=='NC' || document.our_reference!==note.reference) throw new CreditNoteError('O documento Moloni não corresponde a esta nota de crédito.')
  if (!Array.isArray(document.associated_documents) || document.associated_documents.length!==1 || positiveId(record(document.associated_documents[0]).associated_id)!==note.invoice_document_id) throw new CreditNoteError('A associação à fatura original não foi confirmada.')
  const total=amount(document.net_value),tax=amount(document.taxes_value)
  if (!(total>0) || tax>total) throw new CreditNoteError('Os valores da nota de crédito não são válidos.')
  return {total,tax,net:Number((total-tax).toFixed(2))}
}
export async function activeCreditNoteForSource(db:SupabaseClient,tenantId:string,documentId:number) {
  const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','credit_note')
    .eq('details->>invoice_document_id',documentId)
    .order('created_at',{ascending:false}).limit(1).maybeSingle()
  if (error) throw new CreditNoteError('Não foi possível consultar as notas de crédito em curso.')
  if (!data?.details) return null
  const note=data.details as CreditNote
  if (['draft','review_required'].includes(note.state)) return note
  return null
}
export async function refreshCredit(db:SupabaseClient,tenantId:string,note:CreditNote) {
  if (note.state==='cancelled') {await release(db,tenantId,note);return note}
  const {moloni}=await creditMoloni(db,tenantId,note.company_id)
  if (!note.document_id) {
    const found:unknown=await moloni.request('creditNotes/getAll',{our_reference:note.reference,qty:50,offset:0})
    if (!Array.isArray(found)) throw new CreditNoteError('Não foi possível consultar o Moloni.')
    // A search can lag behind an in-flight request. Absence does not prove cancellation.
    if (found.length===0) throw new CreditNoteError('O Moloni ainda não confirmou esta tentativa. Aguarde e consulte novamente; não repita a criação.')
    if (found.length!==1 || record(found[0]).our_reference!==note.reference) throw new CreditNoteError('Não foi encontrado um único documento para esta tentativa. Confirme no Moloni antes de repetir.')
    note=await saveNote(db,tenantId,note,{...note,document_id:positiveId(record(found[0]).document_id)})
  }
  const doc=record(await moloni.request('documents/getOne',{document_id:note.document_id}))
  const totals=validateCreditDocument(note,doc)
  const status=Number(doc.status)
  if (![0,1].includes(status)) throw new CreditNoteError('O documento Moloni foi alterado ou anulado. Confirme o resultado com a equipa de faturação.')
  let state:CreditState=note.state
  if (status===1) state='issued'
  else if (note.phase==='create' || note.state==='draft') state='draft'
  else if (note.state!=='issued') state='review_required'
  else throw new CreditNoteError('O estado Moloni não corresponde à nota de crédito emitida.')
  if (!Array.isArray(doc.products)) throw new CreditNoteError('Não foi possível confirmar as linhas da nota de crédito.')
  const lines=doc.products.map(value=>{const p=record(value);return {name:String(p.name||'Serviço'),qty:amount(p.qty),price:amount(p.price)}})
  const next=await saveNote(db,tenantId,note,{...note,...totals,lines,state,number:documentNumber(doc),error:state==='review_required'?'A operação anterior não foi confirmada. Verifique o Moloni antes de continuar.':undefined})
  if (state==='issued') await release(db,tenantId,next)
  return next
}
function documentNumber(doc:Record<string,unknown>) {
  const series=doc.document_set && typeof doc.document_set==='object' ? String(record(doc.document_set).name || '') : ''
  return `NC ${series ? series+'/' : ''}${String(doc.number || doc.document_id)}`
}
function assertUnchangedDraft(note:CreditNote,doc:Record<string,unknown>) {
  if (!Array.isArray(doc.products) || !Array.isArray(note.payload.products) || doc.products.length!==note.payload.products.length) throw new CreditNoteError('O rascunho foi alterado no Moloni. Cancele este rascunho ou conclua-o diretamente no Moloni.')
  const matches=doc.products.every((value,index)=>{
    const actual=record(value),expected=record((note.payload.products as unknown[])[index])
    const same=['product_id','related_id','qty','price','discount'].every(key=>Number(actual[key]??(key==='discount'?0:NaN))===Number(expected[key]))
    const taxes=Array.isArray(actual.taxes)?actual.taxes.map(value=>{const t=record(value);return [Number(t.tax_id),Number(t.value),Number(t.cumulative||0)]}):null
    const expectedTaxes=(expected.taxes as Record<string,unknown>[]).map(t=>[Number(t.tax_id),Number(t.value),Number(t.cumulative||0)])
    return same && JSON.stringify(taxes)===JSON.stringify(expectedTaxes) && String(actual.exemption_reason||'')===String(expected.exemption_reason||'')
  })
  if(!matches) throw new CreditNoteError('As linhas do rascunho mudaram no Moloni. Cancele o rascunho ou conclua-o diretamente no Moloni.')
}
export async function finishCredit(db:SupabaseClient,tenantId:string,id:string,decision:'issue'|'cancel') {
  let note=await readCreditNote(db,tenantId,id)
  if (note.state==='issued') {await release(db,tenantId,note);return cleanNote(note)}
  if (note.state==='cancelled') {await release(db,tenantId,note);return cleanNote(note)}
  if (decision==='cancel') {
    if (note.state!=='draft' && !(note.state==='review_required' && note.phase==='create')) {
      throw new CreditNoteError('Esta operação está em curso ou precisa de confirmação no Moloni. Consulte o resultado antes de cancelar.')
    }
    const {moloni}=await creditMoloni(db,tenantId,note.company_id)
    if (!note.document_id) {
      const found:unknown=await moloni.request('creditNotes/getAll',{our_reference:note.reference,qty:50,offset:0})
      if (Array.isArray(found) && found.length===0) throw new CreditNoteError('O Moloni ainda não confirmou esta tentativa. Aguarde e consulte novamente antes de cancelar.')
      if (Array.isArray(found) && found.length===1 && record(found[0]).our_reference===note.reference) {
        note=await saveNote(db,tenantId,note,{...note,document_id:positiveId(record(found[0]).document_id)})
      } else {
        throw new CreditNoteError('Esta tentativa precisa de confirmação no Moloni antes de cancelar.')
      }
    }
    const doc=record(await moloni.request('documents/getOne',{document_id:note.document_id}))
    validateCreditDocument(note,doc)
    if (Number(doc.status)!==0) return cleanNote(await refreshCredit(db,tenantId,note))
    note=await saveNote(db,tenantId,note,{...note,state:'cancelling',phase:'cancel'})
    try {
      const result=record(await moloni.request('creditNotes/delete',{document_id:note.document_id}))
      if (Number(result.valid)!==1) throw new CreditNoteError('Cancelamento não confirmado')
      const cancelled=await saveNote(db,tenantId,note,{...note,state:'cancelled',error:undefined})
      await release(db,tenantId,cancelled)
      return cleanNote(cancelled)
    } catch {
      const review={...note,state:'review_required' as const,error:'Não foi possível confirmar o cancelamento no Moloni. Consulte o resultado antes de continuar.'}
      try {await saveNote(db,tenantId,note,review)} catch { /* The cancelling state also blocks competing mutations. */ }
      return cleanNote(review)
    }
  }
  if (note.state!=='draft' || !note.document_id) throw new CreditNoteError('Esta tentativa precisa de confirmação no Moloni. Não repita a emissão.')
  const {moloni}=await creditMoloni(db,tenantId,note.company_id)
  const doc=record(await moloni.request('documents/getOne',{document_id:note.document_id}))
  const totals=validateCreditDocument(note,doc)
  if (Number(doc.status)!==0) return cleanNote(await refreshCredit(db,tenantId,note))
  assertUnchangedDraft(note,doc)
  if (Math.round(totals.total*100)!==Math.round(amount(note.total)*100)) throw new CreditNoteError('O valor do rascunho mudou. Consulte novamente o Moloni antes de confirmar.')
  // The invoice may have received a payment after the operator prepared the draft.
  const original=await creditInvoiceDocument(db,tenantId,note.source)
  if (original.company!==note.company_id || original.documentId!==note.invoice_document_id || positiveId(original.invoice.customer_id)!==note.customer_id) {
    throw new CreditNoteError('A associação à fatura original mudou. Confirme os documentos no Moloni.')
  }
  if (original.invoice.reconciled_value!=null) {
    const remaining=Math.round((amount(original.invoice.net_value)-amount(original.invoice.reconciled_value))*100)
    if (Math.round(totals.total*100)>remaining) throw new CreditNoteError('O valor a creditar excede o valor por liquidar na fatura. Confirme os pagamentos no Moloni.')
  }
  note=await saveNote(db,tenantId,note,{...note,state:'closing',phase:'close'})
  try {
    const associated=record((note.payload.associated_documents as unknown[])[0])
    const value=Number(associated.value)===0 ? 0 : totals.total
    const result=record(await moloni.request('creditNotes/update',{...note.payload,document_id:note.document_id,status:1,
      associated_documents:[{associated_id:note.invoice_document_id,value}]}))
    if (Number(result.valid)!==1) throw new CreditNoteError('Emissão não confirmada')
    return cleanNote(await refreshCredit(db,tenantId,note))
  } catch {
    const review={...note,state:'review_required' as const,error:'Não foi possível confirmar o resultado no Moloni. O pedido não será repetido automaticamente.'}
    try {await saveNote(db,tenantId,note,review)} catch { /* Existing closing state still blocks new mutations. */ }
    return cleanNote(review)
  }
}

