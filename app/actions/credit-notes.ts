'use server'
import { requireUser } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import {unstable_rethrow} from 'next/navigation'
import {CreditNoteError,creditInvoicePayment} from '@/lib/billing/credit-notes/products'
import { revalidatePath } from 'next/cache'
import { creditInvoice, creditSource, creditMoloni, creditNoteDto, prepareCredit, finishCredit, readCreditNote, refreshCredit, activeCreditNoteForSource, type CreditNoteDto } from '@/lib/billing/credit-notes/service'
import type { CreditSource, CreditSelection, CreditNote } from '@/lib/billing/credit-notes/types'

async function respond<T>(operation:()=>Promise<T>):Promise<{success:true;data:T}|{success:false;error:string}> {
  try {return {success:true,data:await operation()}} catch(error) {
    unstable_rethrow(error)
    return {success:false,error:error instanceof CreditNoteError ? error.message : 'Não foi possível consultar ou guardar a operação. Confirme o estado em Notas de Crédito antes de repetir.'}
  }
}
async function finance() {
  const ctx=await requireUser()
  if (ctx.role!=='admin' && !(ctx.role==='employee' && ctx.permissions.some(p=>['Faturação & Contas Correntes','Acesso Total (Super-Admin)'].includes(p)))) throw new CreditNoteError('Sem permissão para gerir notas de crédito.')
  return ctx
}
function invalidate() {revalidatePath('/ops/faturacao/notas-credito');revalidatePath('/ops/faturacao/contas-corrente');revalidatePath('/app','layout')}
export async function previewCreditNoteAction(source:CreditSource) {
  return respond(async()=>{
  const ctx=await finance(),db=createAdminClient()
  const info=await creditInvoice(db,ctx.tenant_id,source)
  const existing=await activeCreditNoteForSource(db,ctx.tenant_id,info.documentId)
  if (existing) return creditNoteDto(existing)
  return {source:info.source,clientName:String(info.details.client_name || info.invoice.entity_name || 'Cliente'),
    invoiceNumber:String(info.details.moloni_document_number || info.details.invoice_number || info.details.statement_number || info.documentId),lines:info.lines}
  })
}
export async function prepareCreditNoteAction(source:CreditSource,id:string,selections:CreditSelection[],reason:string) {
  return respond(async()=>{
  const ctx=await finance()
  const note=await prepareCredit(createAdminClient(),ctx,source,id,selections,reason)
  invalidate();return note
  })
}
export async function confirmCreditNoteAction(id:string) {
  return respond(async()=>{
  const ctx=await finance()
  const note=await finishCredit(createAdminClient(),ctx.tenant_id,id,'issue')
  invalidate();return note
  })
}
export async function cancelCreditNoteDraftAction(id:string) {
  return respond(async()=>{
  const ctx=await finance()
  const note=await finishCredit(createAdminClient(),ctx.tenant_id,id,'cancel')
  invalidate();return note
  })
}
export async function refreshCreditNoteAction(id:string) {
  return respond(async()=>{
  const ctx=await finance(),db=createAdminClient()
  const note=await refreshCredit(db,ctx.tenant_id,await readCreditNote(db,ctx.tenant_id,id))
  invalidate();return creditNoteDto(note)
  })
}
export async function listCreditNotesAction(clientId?:string):Promise<CreditNoteDto[]> {
  const ctx=await requireUser()
  if (ctx.role!=='client') await finance()
  const owner=ctx.role==='client'?ctx.client_id:clientId
  if (ctx.role==='client'&&!owner) throw new Error('Cliente não identificado.')
  const db=createAdminClient(),notes:CreditNoteDto[]=[]
  for (let offset=0;;offset+=1000) {
    let q=db.from('audit_log').select('details').eq('tenant_id',ctx.tenant_id).eq('action','credit_note')
    if (owner) q=q.eq('details->>client_id',owner)
    if (ctx.role==='client') q=q.eq('details->>state','issued')
    const {data,error}=await q.order('created_at',{ascending:false}).order('id').range(offset,offset+999)
    if (error) throw new Error('Não foi possível carregar as notas de crédito.')
    for (const row of data || []) notes.push(creditNoteDto(row.details as CreditNote))
    if (!data || data.length<1000) return notes
  }
}

export async function previewCreditAdjustedReceiptAction(source:CreditSource) {
  return respond(async()=>{
    const ctx=await finance(),db=createAdminClient(),info=await creditSource(db,ctx.tenant_id,source)
    const {company,moloni}=await creditMoloni(db,ctx.tenant_id,info.details.moloni_company_id?String(info.details.moloni_company_id):undefined)
    const doc=await moloni.request('documents/getOne',{document_id:info.documentId})
    const {value:remainingTotal}=creditInvoicePayment(doc,company,info.documentId)
    return {remainingTotal}
  })
}
