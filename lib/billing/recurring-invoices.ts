import type { SupabaseClient } from '@supabase/supabase-js'
import { MoloniClient } from '@/lib/moloni/moloni-client'
import { DEFAULT_BILLING_CONFIG, type BillingConfig } from '@/app/actions/billing-config-types'
import { addCalendarDays, lisbonDate, periodLabel, shipmentTotal, type RecurringClient } from './recurring-periods'
import { paymentDueDays, moloniMaturityDateId } from './payment-terms'
import type { PeriodStatement } from './recurring-statements'

interface InvoiceCycle { id: string; statement_id: string; client_id: string; invoice_status: string; invoice_token: string; invoice_document_id: number }

async function moloniForTenant(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db.from('audit_log').select('details').eq('tenant_id', tenantId)
    .eq('action', 'moloni_connection_config').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !data?.details?.company_id || !data.details.refresh_token) throw new Error('Ligue a conta Moloni desta empresa antes da emissão automática.')
  return new MoloniClient({ tenantId, companyId: String(data.details.company_id), refreshToken: data.details.refresh_token })
}

export async function buildRecurringInvoice(moloni: MoloniClient, client: RecurringClient, statement: PeriodStatement, config: BillingConfig) {
  if (!client.nif || !/^\d{9}$/.test(client.nif) || !client.address || !client.city || !client.postal_code) {
    throw new Error('Complete NIF, morada, localidade e código postal na ficha do cliente.')
  }
  if (!(shipmentTotal(statement.shipments) > 0)) throw new Error('O período não tem um valor positivo para faturar.')
  const existing = await moloni.getCustomerByVat(client.nif)
  const customer = existing?.customer_id || await moloni.createCustomer({ vat: client.nif,
    number: `TMS-${client.id}`, name: client.legal_name || client.short_name || statement.client_name,
    address: client.address, zipCode: client.postal_code, city: client.city, email: client.billing_email || client.email })
  const rate = Number(config.defaultVatRate)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Configure uma taxa de IVA positiva para a faturação automática.')
  const tax = await moloni.getTaxId(rate)
  const series = config.defaultDocumentSetId || await moloni.getDocumentSet()
  const product = await moloni.getGenericProductId(tax, config.articleReference, config.articleDesignation, config.articleSummary)
  if (!tax || !series || !product || !customer) throw new Error('Configuração Moloni incompleta.')
  const groups = new Map<string, { count: number; cents: number }>()
  for (const shipment of statement.shipments) {
    const service = shipment.service_type || config.articleDesignation
    const key = config.defaultGrouping === 'grouped' ? service : `${shipment.tracking_number || shipment.id} · ${service}`
    const group = groups.get(key) || { count: 0, cents: 0 }
    group.count++; group.cents += Math.round(Number(shipment.sell_price) * 100); groups.set(key, group)
  }
  const date = lisbonDate()
  const paymentDays = paymentDueDays(client.payment_due_days, config.defaultPaymentDays)
  const maturityId = await moloniMaturityDateId(moloni, paymentDays)
  return { customer_id: customer, date, expiration_date: addCalendarDays(date, paymentDays),
    maturity_date_id: maturityId, document_set_id: series, status: 1,
    your_reference: `TMS-PERIOD-${statement.id}`, notes: `Período de envios: ${periodLabel(statement.period_start, statement.period_end)}`,
    products: [...groups].filter(([, g]) => g.cents > 0).map(([name, g]) => ({ product_id: product,
      name: config.defaultGrouping === 'grouped' ? `${name} (${g.count} envios)` : name,
      summary: config.articleSummary || '', qty: 1, price: g.cents / 100, discount: 0,
      taxes: [{ tax_id: tax, value: rate, order: 1, cumulative: 0 }] })) }
}

export async function ensureRecurringInvoice(tenantId: string, id: string, client: RecurringClient, db: SupabaseClient) {
  const { data, error } = await db.rpc('claim_recurring_invoice', { p_tenant: tenantId, p_id: id })
  if (error) throw new Error('Não foi possível reservar a emissão automática.')
  if (!data) return false
  const cycle = data as InvoiceCycle
  if (cycle.client_id !== client.id) throw new Error('O período não pertence a este cliente.')
  if (cycle.invoice_status === 'issued') return true
  try {
    const { data: doc, error: readError } = await db.from('audit_log').select('details').eq('tenant_id', tenantId)
      .eq('id', cycle.statement_id).eq('action', 'period_statement').eq('details->>client_id', client.id).single()
    if (readError || !doc?.details) throw new Error('Extrato do período não encontrado.')
    const { data: saved, error: configError } = await db.from('audit_log').select('details').eq('tenant_id', tenantId)
      .eq('action', 'moloni_billing_settings').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (configError) throw new Error('Configuração de faturação indisponível.')
    const moloni = await moloniForTenant(db, tenantId)
    const payload = await buildRecurringInvoice(moloni, client, doc.details as PeriodStatement, { ...DEFAULT_BILLING_CONFIG, ...saved?.details })
    const { data: armed, error: armError } = await db.rpc('arm_recurring_invoice', {
      p_tenant: tenantId, p_id: id, p_token: cycle.invoice_token, p_payload: payload,
    })
    if (armError || !armed) throw new Error('Os envios já estão faturados, reservados ou a configuração mudou. Confirme o período.')
    // Exactly one insert attempt. Never use createInvoice's legacy draft fallback here.
    const result = await moloni.request('invoices/insert', payload)
    if (result?.valid !== 1 || !(Number(result.document_id) > 0)) throw new Error('O Moloni não confirmou a emissão. Confirme no Moloni antes de repetir.')
    // Persist ID immediately, before any PDF/number request, so failures cannot reissue.
    const { data: finished, error: finishError } = await db.rpc('finish_recurring_invoice', {
      p_tenant: tenantId, p_id: id, p_token: cycle.invoice_token, p_document: Number(result.document_id), p_number: null,
    })
    if (finishError || !finished) throw new Error(`Fatura Moloni ${result.document_id} emitida; registo por confirmar. Não repita.`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Emissão automática por confirmar.'
    const { error: saveError } = await db.rpc('fail_recurring_invoice', { p_tenant: tenantId, p_id: id, p_token: cycle.invoice_token, p_error: message })
    if (saveError) throw new Error('Estado da emissão por confirmar. Não repita manualmente.')
    return false
  }
}

export async function recurringInvoiceAttachment(tenantId: string, id: string, db: SupabaseClient) {
  const { data: cycle, error } = await db.from('recurring_statement_cycles').select('invoice_document_id,invoice_statement_id,invoice_status')
    .eq('tenant_id', tenantId).eq('id', id).single()
  if (error || cycle?.invoice_status !== 'issued' || !cycle.invoice_document_id) throw new Error('Fatura oficial ainda não confirmada.')
  const moloni = await moloniForTenant(db, tenantId)
  const document = await moloni.request('documents/getOne', { document_id: Number(cycle.invoice_document_id) })
  if (Number(document?.document_id) !== Number(cycle.invoice_document_id) || Number(document?.status) !== 1 || document?.document_type?.saft_code !== 'FT') throw new Error('A fatura Moloni ainda não está fechada.')
  const pdfUrl = await moloni.getDocumentPDFLink(Number(cycle.invoice_document_id))
  if (!pdfUrl) throw new Error('PDF da fatura Moloni indisponível. O email fica pendente.')
  const response = await fetch(pdfUrl, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('Não foi possível descarregar a fatura Moloni.')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('O Moloni não devolveu um PDF válido. O email fica pendente.')
  const number = `FT ${document.year}/${document.number}`
  const { data: audit, error: readError } = await db.from('audit_log').select('details').eq('tenant_id', tenantId)
    .eq('action', 'billing_statement').eq('id', cycle.invoice_statement_id).single()
  if (readError || !audit) throw new Error('Registo da fatura indisponível.')
  const { error: saveError } = await db.from('audit_log').update({ details: { ...audit.details,
    moloni_document_number: number, moloni_document_pdf: pdfUrl } }).eq('tenant_id', tenantId).eq('action', 'billing_statement').eq('id', cycle.invoice_statement_id)
  if (saveError) throw new Error('Não foi possível guardar o PDF da fatura.')
  return { number, filename: `Fatura_${document.year}_${document.number}.pdf`, content: buffer.toString('base64') }
}

/** For automatic invoices, receipt values come from the issued fiscal document, including taxes. */
export function automaticInvoicePayment(document: { document_id: number; status: number; customer_id: number; net_value: number | string; reconciled_value?: number | string }, expectedId: number) {
  if (Number(document.document_id) !== Number(expectedId) || Number(document.status) !== 1 || !(Number(document.customer_id) > 0)) throw new Error('Não foi possível validar a fatura para o recibo.')
  const total = Number(document.net_value), reconciled = Number(document.reconciled_value || 0)
  const cents = Math.round(total * 100) - Math.round(reconciled * 100)
  if (!Number.isFinite(total) || !Number.isFinite(reconciled) || reconciled < 0 || cents <= 0) throw new Error('A fatura já está paga ou não tem um valor por receber válido.')
  return { customerId: Number(document.customer_id), value: cents / 100 }
}
