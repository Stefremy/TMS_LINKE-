import type { CreditLine, CreditSelection } from './types'
export class CreditNoteError extends Error {}
export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CreditNoteError('Resposta Moloni inválida.')
  return value as Record<string,unknown>
}
export function positiveId(value: unknown): number {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw new CreditNoteError('Identificador Moloni inválido.')
  return n
}
export function amount(value: unknown): number {
  if (value == null || value === '' || !['number','string'].includes(typeof value)) throw new CreditNoteError('Valor Moloni em falta.')
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 100))) throw new CreditNoteError('Valor Moloni inválido.')
  return n
}
export function availableCreditLines(invoice: Record<string,unknown>, available: unknown): CreditLine[] {
  if (!Array.isArray(invoice.products) || !Array.isArray(available)) throw new CreditNoteError('Não foi possível confirmar as linhas disponíveis no Moloni.')
  if (invoice.products.length > 1000 || available.length > 1000) throw new CreditNoteError('Documento demasiado extenso. Consulte o Moloni.')
  const originals = new Map(invoice.products.map(value => { const p=record(value);return [positiveId(p.document_product_id),p] }))
  const seen = new Set<number>()
  return available.map(value => {
    const row=record(value),id=positiveId(row.document_product_id),p=originals.get(id)
    if (!p || seen.has(id)) throw new CreditNoteError('As linhas disponíveis não correspondem à fatura original.')
    seen.add(id)
    const qty=amount(row.qty)
    if (qty > amount(p.qty)) throw new CreditNoteError('Quantidade disponível inválida.')
    const discount=amount(p.discount ?? 0)
    if (discount > 100 || !Array.isArray(p.taxes)) throw new CreditNoteError('Impostos ou descontos da fatura não confirmados.')
    const taxes=p.taxes.map(value => {
      const t=record(value),cumulative=Number(t.cumulative ?? 0),order=Number(t.order ?? 1)
      if (![0,1].includes(cumulative) || !Number.isSafeInteger(order) || order<0) throw new CreditNoteError('Imposto original inválido.')
      return {tax_id:positiveId(t.tax_id),value:amount(t.value),order,cumulative}
    })
    const exemptionReason=typeof p.exemption_reason === 'string' ? p.exemption_reason : ''
    if (!taxes.length && !exemptionReason) throw new CreditNoteError('Falta o motivo de isenção na fatura original.')
    if (Number(p.deduction_id || 0) || (Array.isArray(p.child_products) && p.child_products.length)) throw new CreditNoteError('Este artigo exige tratamento específico no Moloni.')
    return {id,productId:positiveId(p.product_id),name:String(p.name || 'Serviço'),summary:String(p.summary || ''),availableQty:qty,price:amount(p.price),discount,exemptionReason,taxes}
  }).filter(p => p.availableQty > 0 && p.price > 0 && p.discount < 100)
}
export function selectedCreditProducts(lines: CreditLine[], selections: CreditSelection[], documentId: number) {
  if (!Array.isArray(selections) || !selections.length || selections.length > 1000) throw new CreditNoteError('Selecione pelo menos uma linha a creditar.')
  const seen=new Set<number>()
  const products = selections.map(selection => {
    if (!selection || typeof selection.id !== 'number' || typeof selection.qty !== 'number') throw new CreditNoteError('Seleção inválida.')
    const line=lines.find(p=>p.id===selection.id),qty=selection.qty
    if (!line || seen.has(selection.id) || !Number.isFinite(qty) || qty<=0 || qty>line.availableQty || Math.abs(qty*1e6-Math.round(qty*1e6))>1e-5) throw new CreditNoteError('Quantidade a creditar inválida ou superior à disponível.')
    seen.add(selection.id)
    return {product_id:line.productId,related_id:line.id,origin_id:documentId,name:line.name,summary:line.summary,qty,price:line.price,discount:line.discount,exemption_reason:line.exemptionReason,taxes:line.taxes,has_stock:0}
  })
  if (Math.round(products.reduce((sum,p)=>sum+p.qty*p.price*(1-p.discount/100),0)*100)<=0) throw new CreditNoteError('O valor a creditar deve ser superior a zero.')
  return products
}

/** Moloni reports gross totals and reconciliations; never infer a receipt from TMS net values. */
export function creditInvoicePayment(value: unknown, company: string, documentId: number) {
  const doc = record(value)
  if (positiveId(doc.document_id) !== documentId || String(doc.company_id) !== company || Number(doc.status) !== 1) throw new CreditNoteError('Não foi possível confirmar a fatura nesta empresa Moloni.')
  const gross = amount(doc.net_value), reconciled = amount(doc.reconciled_value)
  const remaining = Math.round((gross - reconciled) * 100) / 100
  if (!(remaining > 0)) throw new CreditNoteError('Esta fatura já está integralmente liquidada ou creditada no Moloni.')
  return {customerId: positiveId(doc.customer_id), value: remaining}
}
