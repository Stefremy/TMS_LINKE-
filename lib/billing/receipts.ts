import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import { creditMoloni } from './credit-notes/service'
import { creditInvoicePayment, positiveId, record } from './credit-notes/products'
import { loadInvoiceCredits } from './credit-notes/balances'
import { claimInvoiceFinancialLock, releaseInvoiceFinancialLock, financialId } from './invoice-financial-lock'
import { lisbonDate } from './recurring-periods'
import type { MoloniClient } from '@/lib/moloni/moloni-client'

type Options = { date?: string; paymentMethodId?: number; notes?: string }
type ReceiptOperation = {
  id: string; source_id: string; client_id: string; company: string; invoice: number; customer: number;
  amount: number; date: string; marker: string; state: 'prepared' | 'submitted' | 'confirmed';
  receipt_id?: number; pdf?: string; created_by: string;
}
const pendingMessage = 'O recibo está em curso ou por confirmar no Moloni. Consulte novamente; a criação não será repetida.'

async function source(db: SupabaseClient, tenant: string, id: string) {
  for (const field of ['id', 'details->>id', 'details->>statement_number']) {
    // A human-readable statement number must not be sent to the native UUID column.
    if (field === 'id' && !/^[0-9a-f-]{36}$/i.test(id)) continue
    const { data, error } = await db.from('audit_log').select('id,details').eq('tenant_id', tenant)
      .eq('action', 'billing_statement').eq(field, id).limit(1).maybeSingle()
    if (error) throw new Error('Não foi possível consultar o extrato.')
    if (data) return data
  }
  throw new Error('Extrato não encontrado nesta empresa.')
}
async function save(db: SupabaseClient, tenant: string, old: ReceiptOperation, next: ReceiptOperation) {
  const { data, error } = await db.from('audit_log').update({ details: next }).eq('tenant_id', tenant)
    .eq('action', 'receipt_operation').eq('id', old.id).eq('details->>state', old.state).select('id').maybeSingle()
  if (error || !data) throw new Error(pendingMessage)
  return next
}
function validateReceipt(op: ReceiptOperation, value: unknown) {
  const doc = record(value)
  const associated = Array.isArray(doc.associated_documents) ? doc.associated_documents.map(record) : []
  if (Number(doc.document_id) !== op.receipt_id || String(doc.company_id) !== op.company
    || Number(doc.customer_id) !== op.customer || !['RE', 'RC'].includes(String(record(doc.document_type).saft_code))
    || Number(doc.status) !== 1 || !String(doc.notes || '').split('\n').includes(op.marker)
    || !Number.isFinite(Number(doc.net_value)) || Math.round(Number(doc.net_value) * 100) !== Math.round(op.amount * 100)
    || associated.length !== 1 || Number(associated[0].associated_id) !== op.invoice
    || Math.round(Number(associated[0].value) * 100) !== Math.round(op.amount * 100)) throw new Error(pendingMessage)
}
async function recover(moloni: MoloniClient, op: ReceiptOperation) {
  if (op.receipt_id) return op.receipt_id
  // Receipts/insert documents the notes field, but not our_reference. Recover using a unique
  // notes line, scoped to customer/date, and inspect every candidate instead of guessing by value.
  const matches: number[] = []
  for (let offset = 0; ; offset += 50) {
    const rows: unknown = await moloni.request('receipts/getAll', { customer_id: op.customer, date: op.date, qty: 50, offset })
    if (!Array.isArray(rows)) throw new Error(pendingMessage)
    for (const row of rows) {
      const id = positiveId(record(row).document_id)
      const doc = record(await moloni.request('documents/getOne', { document_id: id }))
      if (String(doc.notes || '').split('\n').includes(op.marker)) matches.push(id)
    }
    if (rows.length < 50) break
  }
  if (matches.length !== 1) throw new Error(pendingMessage)
  return matches[0]
}

export async function emitStatementReceipt(db: SupabaseClient, ctx: AuthContext, statementId: string, opts: Options = {},
  expected?: { client: string; invoice: number }) {
  if (ctx.role !== 'admin' && !(ctx.role === 'employee' && ctx.permissions.some(p =>
    ['Faturação & Contas Correntes','Acesso Total (Super-Admin)'].includes(p)))) throw new Error('Sem permissão para emitir recibos.')
  const original = await source(db, ctx.tenant_id, statementId), stmt = record(original.details)
  const invoice = positiveId(stmt.moloni_document_id), client = String(stmt.client_id || '')
  if (!client || stmt.is_pro_forma || (expected && (expected.client !== client || expected.invoice !== invoice))) {
    throw new Error('A fatura não corresponde ao cliente e ao extrato indicados.')
  }
  const { data: owner, error: ownerError } = await db.from('clients').select('id').eq('tenant_id', ctx.tenant_id).eq('id', client).maybeSingle()
  if (ownerError || !owner) throw new Error('Cliente não encontrado nesta empresa.')
  const { moloni, company } = await creditMoloni(db, ctx.tenant_id, stmt.moloni_company_id ? String(stmt.moloni_company_id) : undefined)
  const id = financialId('receipt', ctx.tenant_id, company, invoice)
  const { data: prior, error: readError } = await db.from('audit_log').select('details').eq('tenant_id', ctx.tenant_id)
    .eq('action', 'receipt_operation').eq('id', id).maybeSingle()
  if (readError) throw new Error(pendingMessage)
  let op = prior?.details as ReceiptOperation | undefined
  if (op && (op.source_id !== original.id || op.client_id !== client || op.company !== company || op.invoice !== invoice)) throw new Error(pendingMessage)
  if ((stmt.moloni_receipt_id || stmt.moloni_receipt_pdf || stmt.status === 'paid') &&
    (!op || op.state !== 'confirmed' || Number(stmt.moloni_receipt_id) !== op.receipt_id)) {
    throw new Error('Este extrato já tem uma liquidação registada.')
  }
  if (!op) {
    await claimInvoiceFinancialLock(db, ctx.tenant_id, company, invoice, id)
    let storeAttempted = false
    try {
      const notes = (await loadInvoiceCredits(db, ctx.tenant_id, client)).filter(n => n.invoice_document_id === invoice)
      if (notes.some(n => !['issued','cancelled'].includes(n.state) || n.company_id !== company)) {
        throw new Error('Confirme a nota de crédito associada antes de emitir recibo.')
      }
      const fiscal = record(await moloni.request('documents/getOne', { document_id: invoice }))
      const payment = creditInvoicePayment(fiscal, company, invoice)
      if (!['FT','FS'].includes(String(record(fiscal.document_type).saft_code)) || Number(fiscal.exchange_currency_id || 0)) {
        throw new Error('Selecione uma fatura em euros válida para emitir o recibo.')
      }
      const net = Number(stmt.total_value), gross = Number(fiscal.net_value), tax = Number(fiscal.taxes_value)
      if (![net,gross,tax].every(Number.isFinite) || Math.abs(Math.round((net + tax) * 100) - Math.round(gross * 100)) > 1) {
        throw new Error('Os valores Moloni não correspondem à fatura TMS. Confirme a associação antes de emitir recibo.')
      }
      const date = opts.date || lisbonDate()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Data de recibo inválida.')
      op = { id, source_id: original.id, client_id: client, company, invoice, customer: payment.customerId,
        amount: payment.value, date, marker: `TMS-RC-${id}`, state: 'prepared', created_by: ctx.user.id }
      storeAttempted = true
      const { error } = await db.from('audit_log').insert({ id, tenant_id: ctx.tenant_id, action: 'receipt_operation', details: op })
      if (error) throw new Error(pendingMessage)
    } catch (error) {
      // A database response can also be lost after committing the prepared operation.
      // Retain its lock whenever persistence was attempted; a later read can recover it.
      if (!storeAttempted) await releaseInvoiceFinancialLock(db, ctx.tenant_id, company, invoice, id)
      throw error
    }
  }
  if (op.state === 'prepared') {
    const { data: lock, error: lockError } = await db.from('audit_log').select('details').eq('tenant_id', ctx.tenant_id)
      .eq('action', 'invoice_financial_lock').eq('id', financialId('invoice-finance', ctx.tenant_id, company, invoice)).maybeSingle()
    if (lockError || lock?.details?.operation_id !== op.id) throw new Error(pendingMessage)
    // Recheck after preparation: a payment made directly in Moloni may have changed the remainder.
    const current = creditInvoicePayment(await moloni.request('documents/getOne', { document_id: op.invoice }), op.company, op.invoice)
    if (current.customerId !== op.customer || Math.round(current.value * 100) !== Math.round(op.amount * 100)) throw new Error(pendingMessage)
    // The CAS grants only one caller the right to make the external insert.
    op = await save(db, ctx.tenant_id, op, { ...op, state: 'submitted' })
    try {
      const result = await moloni.createReceipt({ customerId: op.customer, documentSetId: await moloni.getDocumentSet(),
        date: op.date, invoiceId: op.invoice, value: op.amount, paymentMethodId: opts.paymentMethodId,
        notes: `${opts.notes ? opts.notes.slice(0, 1000) + '\n' : ''}${op.marker}` })
      op = await save(db, ctx.tenant_id, op, { ...op, receipt_id: positiveId(result?.document_id) })
    } catch { throw new Error(pendingMessage) }
  }
  // A repeat performs reads and archive recovery only. It never submits another fiscal document.
  op = await save(db, ctx.tenant_id, op, { ...op, receipt_id: await recover(moloni, op) })
  validateReceipt(op, await moloni.request('documents/getOne', { document_id: op.receipt_id }))
  let pdf = op.pdf || ''
  try { pdf = await moloni.getDocumentPDFLink(op.receipt_id!) || pdf } catch { /* Missing PDF is not missing payment. */ }
  op = await save(db, ctx.tenant_id, op, { ...op, pdf, state: 'confirmed' })
  // Re-read the archive so unrelated document updates are not overwritten with an old snapshot.
  const latest = await source(db, ctx.tenant_id, String(original.id)), details = record(latest.details)
  if (Number(details.moloni_document_id) !== op.invoice || details.client_id !== op.client_id) throw new Error(pendingMessage)
  const { data: archived, error } = await db.from('audit_log').update({ details: { ...details,
    moloni_receipt_id: op.receipt_id, moloni_receipt_pdf: pdf, status: 'paid' } }).eq('tenant_id', ctx.tenant_id)
    .eq('action', 'billing_statement').eq('id', op.source_id).eq('details->>moloni_document_id', op.invoice).select('id').maybeSingle()
  if (error || !archived) throw new Error('Recibo confirmado no Moloni; arquivo TMS pendente. Consulte novamente para recuperar, sem emitir outro recibo.')
  await releaseInvoiceFinancialLock(db, ctx.tenant_id, company, invoice, id)
  return { success: true as const, receiptId: op.receipt_id, receiptPdfUrl: pdf, moloniReceiptPdf: pdf }
}
