import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureRecurringInvoice, recurringInvoiceAttachment } from '@/lib/billing/recurring-invoices'
import { sendEmail } from '@/lib/email/resend'
import { generateStatementPdfBuffer } from '@/lib/services/billing/statement-pdf'
import {
  addCalendarDays, billingRecipient, eligibleRecurringClient, isBillingDeliveryHour,
  lisbonDate, periodForClient, periodLabel, selectPeriodShipments, shipmentTotal,
  type PeriodShipment, type RecurringClient,
} from './recurring-periods'

export interface PeriodStatement {
  id: string
  client_id: string
  client_name: string
  document_type: 'period_statement'
  statement_number: string
  period_start: string
  period_end: string
  cycle_days: number
  total_value: number
  shipments_count: number
  shipment_ids: string[]
  shipments: PeriodShipment[]
  created_at: string
  client_snapshot: { name: string; nif?: string; address?: string; city?: string }
  invoice_status?: string
  invoice_statement_id?: string
  invoice_error?: string
  email_status: string
  email_sent_at?: string | null
  email_error?: string | null
}
interface AuditRow { id: string; details: Record<string, unknown>; action: string; created_at: string }
interface Settings { enabled: boolean; anchor_date: string }
interface Cycle {
  id: string; client_id: string; period_end: string; statement_id: string;
  delivery_status: string; lease_token: string; email_payload: StatementEmail | null;
  first_attempt_at: string | null
}
interface StatementEmail {
  to: string; from: string; subject: string; html: string;
  attachments: { filename: string; content: string }[]
}
export interface RecurringPreview {
  ready: boolean; error?: string; enabled: boolean; anchorDate: string; previewDate: string;
  cronConfigured: boolean; emailConfigured: boolean;
  clients: { id: string; name: string; terms: string; recipient: string | null;
    start: string | null; end: string | null; days: number | null; due: boolean;
    shipmentCount: number; total: number; error?: string }[]
}

async function tenantRows<T>(db: SupabaseClient, table: string, fields: string, tenantId: string, actions?: string[]): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select(fields).eq('tenant_id', tenantId).order('created_at', { ascending: false }).order('id', { ascending: false })
    if (actions) query = query.in('action', actions)
    const { data, error } = await query.range(offset, offset + 999)
    if (error) throw new Error(`Não foi possível carregar ${table === 'recurring_statement_cycles' ? 'os ciclos automáticos' : 'os dados de faturação'}.`)
    all.push(...(data as unknown as T[]))
    if (data.length < 1000) return all
  }
}

export async function loadRecurringClients(db: SupabaseClient, tenantId: string): Promise<RecurringClient[]> {
  const [profiles, registry] = await Promise.all([
    tenantRows<AuditRow>(db, 'audit_log', 'id,action,details,created_at', tenantId, ['client_data', 'deleted_client']),
    tenantRows<{ id: string }>(db, 'clients', 'id,created_at', tenantId),
  ])
  const registered = new Set(registry.map(c => c.id))
  const deleted = new Set(profiles.filter(p => p.action === 'deleted_client').map(p => p.details?.id))
  const latest = new Map<string, RecurringClient>()
  for (const profile of profiles) {
    const id = profile.details?.id
    if (profile.action === 'client_data' && typeof id === 'string' && registered.has(id) && !deleted.has(id) && !latest.has(id)) {
      latest.set(id, { ...profile.details, id, tenant_id: tenantId } as RecurringClient)
    }
  }
  // A return from prepaid/inactive starts a new eligibility window. Ordinary edits do not reset it.
  for (const client of latest.values()) {
    let oldestEligible: string | undefined
    for (const profile of profiles.filter(p => p.action === 'client_data' && p.details?.id === client.id)) {
      if (!eligibleRecurringClient(profile.details as unknown as RecurringClient)) {
        if (oldestEligible) client.recurring_since = lisbonDate(oldestEligible)
        break
      }
      oldestEligible = profile.created_at
    }
  }
  return [...latest.values()].filter(eligibleRecurringClient)
}

async function settingsFor(db: SupabaseClient, tenantId: string): Promise<Settings | null> {
  const { data, error } = await db.from('recurring_statement_settings').select('enabled,anchor_date').eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new Error('A base de dados dos extratos automáticos ainda não está preparada.')
  return data as Settings | null
}

export async function recurringPreview(tenantId: string, asOf = lisbonDate(), db = createAdminClient(), options: { forPlanning?: boolean } = {}): Promise<RecurringPreview> {
  const base: RecurringPreview = { ready: true, enabled: false, anchorDate: lisbonDate(), previewDate: asOf,
    cronConfigured: Boolean(process.env.CRON_SECRET), emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.STORE_FROM_EMAIL), clients: [] }
  try {
    const [settings, clients, cycles, shipments, invoices] = await Promise.all([
      settingsFor(db, tenantId), loadRecurringClients(db, tenantId),
      tenantRows<Cycle>(db, 'recurring_statement_cycles', 'id,client_id,period_end,created_at', tenantId),
      tenantRows<PeriodShipment>(db, 'shipments', 'id,tenant_id,client_id,created_at,status,sell_price,tracking_number,service_type,recipient_name,recipient_address', tenantId),
      tenantRows<AuditRow>(db, 'audit_log', 'id,details,created_at', tenantId, ['billing_statement']),
    ])
    base.enabled = settings?.enabled || false
    base.anchorDate = settings?.anchor_date || lisbonDate()
    const invoiced = new Set<string>()
    for (const { details } of invoices) {
      if ((details.moloni_document_id || details.moloni_document_pdf) && !details.is_pro_forma && Array.isArray(details.shipment_ids)) {
        details.shipment_ids.forEach(id => { if (typeof id === 'string') invoiced.add(id) })
      }
    }
    base.clients = clients.map(client => {
      const lastEnd = cycles.filter(c => c.client_id === client.id).map(c => c.period_end).sort().at(-1)
      let period = periodForClient(client, base.anchorDate, lastEnd)
      const row: RecurringPreview['clients'][number] = { id: client.id, name: client.short_name || client.legal_name || 'Cliente',
        terms: client.payment_terms || 'Não definida', recipient: billingRecipient(client), start: period?.start || null,
        end: period?.end || null, days: period?.days || null, due: Boolean(period && period.end <= asOf), shipmentCount: 0, total: 0 }
      if (!period) { row.error = 'Condição de pagamento não suportada.'; return row }
      try {
        let selected = selectPeriodShipments(client.id, tenantId, period.start, period.end, shipments, invoiced)
        // Planning remains useful while automation is off: skip closed periods with no unbilled work.
        // No cursor, invoice, or financial record is written by this projection.
        if (options.forPlanning) {
          while (period.end <= asOf && selected.length === 0) {
            const next = periodForClient(client, base.anchorDate, period.end)
            if (!next || next.end <= period.end) throw new Error('Não foi possível calcular o próximo período.')
            period = next
            selected = selectPeriodShipments(client.id, tenantId, period.start, period.end, shipments, invoiced)
          }
          row.start = period.start; row.end = period.end; row.days = period.days; row.due = period.end <= asOf
        }
        row.shipmentCount = selected.length
        row.total = shipmentTotal(selected)
      } catch (error) { row.error = error instanceof Error ? error.message : 'Não foi possível validar os envios.' }
      return row
    })
    return base
  } catch (error) {
    return { ...base, ready: false, error: error instanceof Error ? error.message : 'Pré-visualização indisponível.' }
  }
}

/** Read-only closure projection, independent of whether invoice automation is enabled. */
export async function recurringPlanningPreview(tenantId: string, asOf = lisbonDate(), db = createAdminClient()) {
  return recurringPreview(tenantId, asOf, db, { forPlanning: true })
}

export async function loadPeriodStatements(tenantId: string, clientId?: string, db = createAdminClient()): Promise<PeriodStatement[]> {
  const rows = await tenantRows<AuditRow>(db, 'audit_log', 'id,details,created_at', tenantId, ['period_statement'])
  return rows.filter(row => !clientId || row.details.client_id === clientId)
    .map(row => ({ ...row.details, id: row.id, document_type: 'period_statement', invoice_status: row.details.invoice_status || 'pending', created_at: row.details.created_at || row.created_at }) as PeriodStatement)
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function statementEmail(statement: PeriodStatement, recipient: string, isTest = false): Promise<StatementEmail> {
  const label = periodLabel(statement.period_start, statement.period_end)
  const pdf = await generateStatementPdfBuffer({ statementNumber: statement.statement_number,
    clientName: statement.client_snapshot.name, clientNif: statement.client_snapshot.nif,
    clientAddress: statement.client_snapshot.address, clientCity: statement.client_snapshot.city,
    clientEmail: recipient, dateStr: lisbonDate(statement.created_at).split('-').reverse().join('/'),
    periodLabel: label, totalValue: statement.total_value,
    shipments: statement.shipments.map(s => ({ ...s, sell_price: Number(s.sell_price) })),
  })
  const amount = statement.total_value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
  return { to: recipient, from: process.env.STORE_FROM_EMAIL || 'notificacoes@linke.pt',
    subject: `${isTest ? '[TESTE] ' : ''}Linke | Extrato de envios · ${label}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17251e;padding:24px"><h2 style="color:#128a47">${isTest ? 'Teste de ' : ''}Extrato de Envios</h2>${isTest ? '<p><strong>Dados fictícios para testar a entrega. Não representa uma cobrança.</strong></p>' : ''}<p>Olá ${escapeHtml(statement.client_name)},</p><p>Segue em anexo o extrato dos envios do período <strong>${escapeHtml(label)}</strong>.</p><p>${statement.shipments_count} envio(s) · Valor líquido dos envios (s/ IVA): <strong>${escapeHtml(amount)}</strong></p><p>Referência: ${escapeHtml(statement.statement_number)}</p><p style="font-size:12px;color:#68756d">Este é um extrato interno de movimentos. Não substitui uma fatura.</p><p>Equipa Linke</p></div>`,
    attachments: [{ filename: `${isTest ? 'TESTE_' : ''}Extrato_${statement.statement_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, content: pdf.toString('base64') }],
  }
}

export async function deliverPeriodStatement(tenantId: string, id: string, client: RecurringClient, db = createAdminClient()) {
  if (!eligibleRecurringClient(client)) return { status: 'skipped' }
  if (!await ensureRecurringInvoice(tenantId, id, client, db)) return { status: 'failed' }
  const { data, error } = await db.rpc('claim_recurring_statement_email', { p_tenant: tenantId, p_id: id })
  if (error) throw new Error('Não foi possível reservar o envio do extrato.')
  if (!data) return { status: 'skipped' }
  const cycle = data as Cycle
  if (cycle.client_id !== client.id) throw new Error('O extrato não pertence a este cliente.')
  const finish = async (status: string, messageId: string | null, message: string | null) => {
    const { data: finished, error: finishError } = await db.rpc('finish_recurring_statement_email', {
      p_tenant: tenantId, p_id: id, p_token: cycle.lease_token, p_status: status, p_message_id: messageId, p_error: message,
    })
    if (finishError || !finished) throw new Error('Não foi possível confirmar o estado de entrega. O envio será verificado sem duplicar o email.')
    return { status }
  }
  let payload = cycle.email_payload
  if (!payload) {
    const recipient = billingRecipient(client)
    if (!recipient) return finish('blocked', null, 'Configure um email de faturação válido na ficha do cliente.')
    try {
      const { data: record, error: readError } = await db.from('audit_log').select('details')
        .eq('tenant_id', tenantId).eq('action', 'period_statement').eq('id', cycle.statement_id).eq('details->>client_id', client.id).single()
      if (readError || !record?.details) throw new Error('Extrato não encontrado.')
      const invoice = await recurringInvoiceAttachment(tenantId, id, db)
      payload = await statementEmail(record.details as PeriodStatement, recipient)
      payload.attachments.unshift({ filename: invoice.filename, content: invoice.content })
      payload.subject = `Linke | Fatura ${invoice.number} e extrato · ${periodLabel(record.details.period_start, record.details.period_end)}`
      payload.html = payload.html.replace('Segue em anexo o extrato', `Seguem em anexo a fatura ${escapeHtml(invoice.number)} e o extrato`)
    } catch {
      return finish('failed', null, 'Não foi possível obter os dois PDFs. A fatura emitida não será repetida; o email fica pendente.')
    }
  }
  // A stored payload, recipient and idempotency key are never changed after an attempt.
  const { data: prepared, error: prepareError } = await db.rpc('prepare_recurring_statement_email', {
    p_tenant: tenantId, p_id: id, p_token: cycle.lease_token, p_payload: payload,
  })
  if (prepareError || !prepared) throw new Error('A reserva do email expirou. Nenhum novo envio foi iniciado.')
  const sent = await sendEmail({ ...payload, idempotencyKey: `period-statement/${tenantId}/${id}` })
  if (!sent.success || !sent.data?.id) return finish('failed', null, 'O serviço de email não confirmou a aceitação. A repetição manterá a mesma referência.')
  return finish('sent', sent.data.id, null)
}

export async function runRecurringStatements(now = new Date(), db = createAdminClient()) {
  if (!isBillingDeliveryHour(now)) return { generated: 0, sent: 0, skipped: 'outside_delivery_hours', errors: [] as string[] }
  const { data: settings, error } = await db.from('recurring_statement_settings').select('tenant_id,enabled,anchor_date').eq('enabled', true)
  if (error) throw new Error('Não foi possível carregar os agendamentos de extratos.')
  const result = { generated: 0, sent: 0, skipped: '', errors: [] as string[] }
  const deadline = Date.now() + 210000
  for (const config of settings || []) {
    if (Date.now() > deadline) break
    const tenantId = config.tenant_id as string
    try {
      const [clients, cycles] = await Promise.all([
        loadRecurringClients(db, tenantId), tenantRows<Cycle>(db, 'recurring_statement_cycles', 'id,client_id,period_end,created_at', tenantId),
      ])
      for (const client of clients) {
        let lastEnd = cycles.filter(c => c.client_id === client.id).map(c => c.period_end).sort().at(-1)
        for (let count = 0; count < 12 && Date.now() < deadline; count++) {
          const period = periodForClient(client, config.anchor_date, lastEnd)
          if (!period || period.end > lisbonDate(now)) break
          const { data: reserved, error: reserveError } = await db.rpc('reserve_recurring_statement', {
            p_tenant: tenantId, p_client: client.id, p_start: period.start, p_end: period.end,
          })
          if (reserveError) { result.errors.push(`Não foi possível fechar o período do cliente ${client.id}.`); break }
          if (!reserved || reserved.skipped) break
          if (!reserved.empty) result.generated++
          lastEnd = period.end
        }
      }
      const activeClients = new Map(clients.map(c => [c.id, c]))
      const { data: pending, error: pendingError } = await db.from('recurring_statement_cycles')
        .select('id,client_id').eq('tenant_id', tenantId).in('delivery_status', ['pending', 'failed', 'blocked', 'processing'])
        .order('created_at', { ascending: true }).limit(50)
      if (pendingError) throw new Error('Não foi possível carregar os emails pendentes.')
      for (const cycle of pending || []) {
        if (Date.now() > deadline) break
        const client = activeClients.get(cycle.client_id)
        if (!client) continue
        try {
          const delivery = await deliverPeriodStatement(tenantId, cycle.id, client, db)
          if (delivery.status === 'sent') result.sent++
          else if (delivery.status === 'failed' || delivery.status === 'blocked') result.errors.push(`Email pendente: ${cycle.id}.`)
        } catch { result.errors.push(`Entrega por confirmar: ${cycle.id}.`) }
      }
    } catch { result.errors.push(`Não foi possível processar os extratos da empresa ${tenantId}.`) }
  }
  return result
}

export async function sendRecurringStatementTest(tenantId: string, recipient: string, db = createAdminClient()) {
  if (!billingRecipient({ id: 'test', email: recipient })) throw new Error('Indique um email de teste válido.')
  const start = lisbonDate(), end = addCalendarDays(start, 7), testId = crypto.randomUUID()
  const statement: PeriodStatement = { id: testId, client_id: 'test', client_name: 'Cliente de teste Linke',
    document_type: 'period_statement', statement_number: `TESTE-${testId.slice(0, 8)}`, period_start: start, period_end: end,
    cycle_days: 7, total_value: 8.41, shipments_count: 2, shipment_ids: ['test-1', 'test-2'],
    shipments: [3.91, 4.50].map((price, index) => ({ id: `test-${index + 1}`, client_id: 'test', created_at: new Date().toISOString(),
      status: 'pendente', sell_price: price, tracking_number: `TESTE-ENVIO-${index + 1}`, service_type: 'Serviço de teste', recipient_name: 'Destinatário fictício' })),
    created_at: new Date().toISOString(), client_snapshot: { name: 'Cliente de teste Linke' }, email_status: 'test',
  }
  const payload = await statementEmail(statement, recipient, true)
  const result = await sendEmail({ ...payload, idempotencyKey: `period-statement-test/${testId}` })
  if (!result.success || !result.data?.id) throw new Error('O serviço de email não confirmou a aceitação do teste.')
  const { error } = await db.from('audit_log').insert({ tenant_id: tenantId, action: 'period_statement_test_email',
    details: { recipient, provider_message_id: result.data.id, created_at: new Date().toISOString() } })
  if (error) return { success: true, message: 'Email de teste aceite; não foi possível guardar o registo do teste.' }
  return { success: true, message: `Email de teste aceite para ${recipient}. Confirme a receção e o PDF na caixa de entrada.` }
}
