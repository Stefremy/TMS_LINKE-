import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import { authorizeMessageClient } from './server'
import { canSendClientMessages, ClientMessageError, messageText, messageUuid } from './types'
import { announcementIsVisible, type ClientAnnouncement } from './announcements'

const ACTION = 'client_announcement'
type Row = { id: string; created_at?: string; details: Record<string, unknown> }
function requirePublisher(ctx: AuthContext | null) {
  if (!ctx?.tenant_id || !ctx.user?.id) throw new ClientMessageError('Inicie sessão.', 401)
  if (!canSendClientMessages(ctx)) throw new ClientMessageError('Sem permissão para publicar comunicados.', 403)
  return ctx
}
function publicNotice(row: Row): ClientAnnouncement | null {
  const d = row.details
  if (!d || !messageUuid(row.id) || !['all', 'client'].includes(String(d.target)) ||
    !['info', 'warning'].includes(String(d.level)) || typeof d.title !== 'string' || typeof d.body !== 'string' ||
    (d.target === 'client' && !messageUuid(d.client_id))) return null
  return { id: row.id, title: d.title, body: d.body, level: d.level as 'info' | 'warning',
    target: d.target as 'all' | 'client', clientId: typeof d.client_id === 'string' ? d.client_id : null,
    expiresAt: typeof d.expires_at === 'string' ? d.expires_at : null,
    active: d.active === true, createdAt: String(d.created_at || row.created_at || '') }
}
export async function listClientAnnouncements(db: SupabaseClient, ctx: AuthContext | null, clientId: string, manage = false) {
  const scope = manage ? requirePublisher(ctx) : await authorizeMessageClient(db, ctx, clientId)
  const tenant = 'tenant_id' in scope ? scope.tenant_id : scope.tenant
  const notices: ClientAnnouncement[] = []
  for (let offset = 0; ; offset += 500) {
    let query = db.from('audit_log').select('id, created_at, details').eq('tenant_id', tenant).eq('action', ACTION)
    if (!manage) query = query.eq('details->>active', true)
    const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
    if (error) throw new ClientMessageError('Não foi possível consultar os comunicados.', 503)
    for (const row of (data || []) as Row[]) {
      const notice = publicNotice(row)
      if (notice && (manage || announcementIsVisible(notice, clientId))) notices.push(notice)
    }
    if (!data || data.length < 500) return { notices }
  }
}
export async function publishClientAnnouncement(db: SupabaseClient, ctx: AuthContext | null, input: Record<string, unknown>) {
  const actor = requirePublisher(ctx)
  if (!messageUuid(input.requestId)) throw new ClientMessageError('Pedido inválido.')
  const title = messageText(input.title, 160), body = messageText(input.body, 4000)
  if (input.level !== 'info' && input.level !== 'warning') throw new ClientMessageError('Tipo de comunicado inválido.')
  if (input.target !== 'all' && input.target !== 'client') throw new ClientMessageError('Destinatários inválidos.')
  const target = input.target === 'all' ? 'all' : 'client'
  const clientId = target === 'all' ? null : String(input.clientId || '')
  if (clientId !== null) await authorizeMessageClient(db, actor, clientId)
  let expiresAt: string | null = null
  if (input.expiresAt) {
    if (typeof input.expiresAt !== 'string' || !Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now()) throw new ClientMessageError('A data de fim deve ser futura.')
    expiresAt = new Date(input.expiresAt).toISOString()
  }
  const config = { title, body, level: input.level, target, client_id: clientId, expires_at: expiresAt }
  const existing = async () => {
    const { data, error } = await db.from('audit_log').select('id, created_at, details')
      .eq('tenant_id', actor.tenant_id).eq('action', ACTION).eq('id', input.requestId).maybeSingle()
    if (error) throw new ClientMessageError('Não foi possível verificar este comunicado.', 503)
    return data as Row | null
  }
  const validatePrior = (prior: Row) => {
    if (prior.details.sender_id !== actor.user.id || Object.entries(config).some(([key, value]) => prior.details[key] !== value)) throw new ClientMessageError('Este pedido já foi usado para outro comunicado.', 409)
    if (prior.details.active !== true) throw new ClientMessageError('Este comunicado já foi retirado. Crie um novo.', 409)
    return { notice: publicNotice(prior) }
  }
  const prior = await existing()
  if (prior) return validatePrior(prior)
  const now = new Date().toISOString()
  const record = { id: input.requestId, tenant_id: actor.tenant_id, action: ACTION,
    details: { ...config, active: true, created_at: now, sender_id: actor.user.id } }
  const { error } = await db.from('audit_log').insert(record)
  if (error) {
    if (error.code === '23505') { const raced = await existing(); if (raced) return validatePrior(raced) }
    throw new ClientMessageError('Não foi possível publicar o comunicado. Tente novamente.', 503)
  }
  return { notice: publicNotice({ ...record, created_at: now }) }
}
export async function withdrawClientAnnouncement(db: SupabaseClient, ctx: AuthContext | null, id: unknown) {
  const actor = requirePublisher(ctx)
  if (!messageUuid(id)) throw new ClientMessageError('Comunicado inválido.')
  const { data, error } = await db.from('audit_log').select('id, details')
    .eq('tenant_id', actor.tenant_id).eq('action', ACTION).eq('id', id).maybeSingle()
  if (error) throw new ClientMessageError('Não foi possível consultar o comunicado.', 503)
  if (!data) throw new ClientMessageError('Comunicado não encontrado.', 404)
  const result = await db.from('audit_log').update({ details: { ...data.details, active: false, withdrawn_at: new Date().toISOString(), withdrawn_by: actor.user.id } })
    .eq('tenant_id', actor.tenant_id).eq('action', ACTION).eq('id', id)
  if (result.error) throw new ClientMessageError('Não foi possível retirar o comunicado.', 503)
  return { success: true }
}
