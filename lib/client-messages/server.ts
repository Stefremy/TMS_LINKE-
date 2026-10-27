import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import {
  canSendClientMessages,
  ClientMessageError,
  messageText,
  messageUuid,
  type ClientMessage,
  type MessageKind,
  type MessagePage,
  type MessageSection,
} from './types'

type AuthorizedScope = { tenant: string; client: string; user: string }

function isMissingMessagesSchema(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code))
}

export async function authorizeMessageClient(db: SupabaseClient, ctx: AuthContext | null, clientId: string): Promise<AuthorizedScope> {
  if (!ctx?.user?.id || !ctx.tenant_id || !['client', 'employee', 'admin'].includes(ctx.role || '')) {
    throw new ClientMessageError('Inicie sessão para consultar as mensagens.', 401)
  }
  if (!messageUuid(clientId) || (ctx.role === 'client' && ctx.client_id !== clientId)) {
    throw new ClientMessageError('Sem acesso a estas mensagens.', 403)
  }
  const { data, error } = await db.from('clients').select('id').eq('tenant_id', ctx.tenant_id).eq('id', clientId).maybeSingle()
  if (error) throw new ClientMessageError('Não foi possível verificar o acesso às mensagens.', 503)
  if (!data) throw new ClientMessageError('Sem acesso a estas mensagens.', 403)
  return { tenant: ctx.tenant_id, client: clientId, user: String(ctx.user.id) }
}

async function listClientMessagesFromAuditLog(
  db: SupabaseClient,
  scope: AuthorizedScope,
  params: URLSearchParams
): Promise<MessagePage> {
  const [msgRes, readRes] = await Promise.all([
    db
      .from('audit_log')
      .select('id, created_at, details')
      .eq('tenant_id', scope.tenant)
      .eq('action', 'client_message')
      .eq('details->>client_id', scope.client)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('audit_log')
      .select('created_at, details')
      .eq('tenant_id', scope.tenant)
      .eq('action', 'client_message_read')
      .eq('details->>client_id', scope.client)
      .eq('details->>user_id', scope.user)
      .limit(2000),
  ])

  if (msgRes.error || readRes.error) {
    throw new ClientMessageError('Não foi possível carregar as mensagens. Tente novamente.', 503)
  }

  const readMap = new Map<string, string>()
  for (const r of readRes.data || []) {
    const details = (r as { details?: Record<string, unknown>; created_at?: string }).details
    const msgId = details?.message_id
    const readAt = details?.read_at ?? (r as { created_at?: string }).created_at
    if (typeof msgId === 'string' && typeof readAt === 'string' && !readMap.has(msgId)) {
      readMap.set(msgId, readAt)
    }
  }

  const seenIds = new Set<string>()
  const seenSourceKeys = new Set<string>()
  const allMessages: ClientMessage[] = []

  const rawRows = [...(msgRes.data || [])].sort((a: any, b: any) => {
    const ca = String(a.details?.created_at || a.created_at || '')
    const cb = String(b.details?.created_at || b.created_at || '')
    return ca.localeCompare(cb)
  })

  for (const row of rawRows as Array<{ id?: string; created_at?: string; details?: Record<string, unknown> }>) {
    const d = row.details || {}
    const id = messageUuid(d.id) ? d.id : messageUuid(row.id) ? row.id : null
    if (!id || d.client_id !== scope.client) continue
    const sourceKey = typeof d.source_key === 'string' && d.source_key ? d.source_key : id
    if (seenIds.has(id) || seenSourceKeys.has(sourceKey)) continue
    seenIds.add(id)
    seenSourceKeys.add(sourceKey)

    const msgKind: MessageKind =
      typeof d.kind === 'string' && ['info', 'invoice', 'payment', 'incident', 'weight'].includes(d.kind)
        ? (d.kind as MessageKind)
        : 'info'
    const section: MessageSection =
      typeof d.section === 'string' && ['envios', 'faturas', 'carregamentos'].includes(d.section)
        ? (d.section as MessageSection)
        : null
    const createdAt =
      typeof d.created_at === 'string' && Number.isFinite(Date.parse(d.created_at))
        ? d.created_at
        : String(row.created_at || new Date().toISOString())

    allMessages.push({
      id,
      kind: msgKind,
      title: String(d.title || 'Aviso'),
      body: String(d.body || ''),
      section,
      reference: typeof d.reference === 'string' ? d.reference : null,
      created_at: createdAt,
      read_at: readMap.get(id) || null,
    })
  }

  allMessages.sort((a, b) => {
    const tDiff = Date.parse(b.created_at) - Date.parse(a.created_at)
    if (tDiff !== 0) return tDiff
    return b.id.localeCompare(a.id)
  })

  const unreadCount = allMessages.filter((m) => !m.read_at).length
  const unreadOnly = params.get('unread') === '1'
  const kind = params.get('kind')
  const at = params.get('before')
  const beforeId = params.get('beforeId')
  const pageSize = params.get('summary') === '1' ? 0 : 20

  const filtered = allMessages.filter((m) => {
    if (unreadOnly && m.read_at) return false
    if (kind && m.kind !== kind) return false
    if (at && beforeId) {
      const tMsg = Date.parse(m.created_at)
      const tBefore = Date.parse(at)
      if (tMsg > tBefore) return false
      if (tMsg === tBefore && m.id >= beforeId) return false
    }
    return true
  })

  if (pageSize === 0) {
    return { messages: [], unreadCount, next: null }
  }

  const page = filtered.slice(0, pageSize)
  const hasMore = filtered.length > pageSize
  const last = page[page.length - 1]
  return {
    messages: page,
    unreadCount,
    next: hasMore && last ? { at: last.created_at, id: last.id } : null,
  }
}

export async function listClientMessages(
  db: SupabaseClient,
  ctx: AuthContext | null,
  clientId: string,
  params: URLSearchParams
): Promise<MessagePage> {
  const scope = await authorizeMessageClient(db, ctx, clientId)
  const at = params.get('before')
  const id = params.get('beforeId')
  if (!!at !== !!id || (at && (!Number.isFinite(Date.parse(at)) || !messageUuid(id)))) {
    throw new ClientMessageError('Página de mensagens inválida.')
  }
  const kind = params.get('kind')
  if (kind && !['info', 'invoice', 'payment', 'incident', 'weight'].includes(kind)) {
    throw new ClientMessageError('Tipo de mensagem inválido.')
  }
  const { data, error } = await db.rpc('client_message_page', {
    p_tenant: scope.tenant,
    p_client: scope.client,
    p_user: scope.user,
    p_before: at,
    p_before_id: id,
    p_unread: params.get('unread') === '1',
    p_limit: params.get('summary') === '1' ? 0 : 20,
    p_kind: kind,
  })
  if (error) {
    if (isMissingMessagesSchema(error)) {
      return listClientMessagesFromAuditLog(db, scope, params)
    }
    throw new ClientMessageError('Não foi possível carregar as mensagens. Tente novamente.', 503)
  }
  if (!data) return { messages: [], unreadCount: 0, next: null }
  return data as MessagePage
}

export async function markClientMessagesRead(
  db: SupabaseClient,
  ctx: AuthContext | null,
  clientId: string,
  ids: unknown
) {
  const scope = await authorizeMessageClient(db, ctx, clientId)
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id) => !messageUuid(id))) {
    throw new ClientMessageError('Seleção de mensagens inválida.')
  }
  const uniqueIds = [...new Set(ids)]
  const { error } = await db.rpc('mark_client_messages_read', {
    p_tenant: scope.tenant,
    p_client: scope.client,
    p_user: scope.user,
    p_ids: uniqueIds,
  })
  if (!error) return

  if (!isMissingMessagesSchema(error)) {
    throw new ClientMessageError('Não foi possível marcar as mensagens como lidas.', 503)
  }

  // Fallback via audit_log: verify every target message belongs to (tenant, client) before recording reads.
  const [msgRes, readRes] = await Promise.all([
    db
      .from('audit_log')
      .select('id, details')
      .eq('tenant_id', scope.tenant)
      .eq('action', 'client_message')
      .eq('details->>client_id', scope.client),
    db
      .from('audit_log')
      .select('details')
      .eq('tenant_id', scope.tenant)
      .eq('action', 'client_message_read')
      .eq('details->>client_id', scope.client)
      .eq('details->>user_id', scope.user),
  ])

  if (msgRes.error || readRes.error) {
    throw new ClientMessageError('Não foi possível marcar as mensagens como lidas.', 503)
  }

  const validIds = new Set(
    (msgRes.data || [])
      .map((r: any) => (messageUuid(r.details?.id) ? r.details.id : messageUuid(r.id) ? r.id : null))
      .filter(Boolean)
  )
  if (uniqueIds.some((id) => !validIds.has(id))) {
    throw new ClientMessageError('Não foi possível marcar as mensagens como lidas.', 503)
  }

  const alreadyRead = new Set(
    (readRes.data || []).map((r: any) => r.details?.message_id).filter((v: unknown): v is string => typeof v === 'string')
  )
  const readAt = new Date().toISOString()
  const rowsToInsert = uniqueIds
    .filter((id) => !alreadyRead.has(id))
    .map((id) => ({
      tenant_id: scope.tenant,
      action: 'client_message_read',
      details: {
        message_id: id,
        client_id: scope.client,
        user_id: scope.user,
        read_at: readAt,
      },
    }))

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await db.from('audit_log').insert(rowsToInsert)
    if (insertError) {
      throw new ClientMessageError('Não foi possível marcar as mensagens como lidas.', 503)
    }
  }
}

export async function sendClientMessage(
  db: SupabaseClient,
  ctx: AuthContext | null,
  input: Record<string, unknown>
) {
  if (!canSendClientMessages(ctx)) {
    throw new ClientMessageError('Sem permissão para enviar avisos aos clientes.', 403)
  }
  const scope = await authorizeMessageClient(db, ctx, String(input.clientId || ''))
  const title = messageText(input.title, 160)
  const body = messageText(input.body, 4000)
  if (!messageUuid(input.requestId)) {
    throw new ClientMessageError('Pedido de envio inválido.')
  }
  const { data, error } = await db.rpc('send_client_message', {
    p_tenant: scope.tenant,
    p_client: scope.client,
    p_user: scope.user,
    p_request: input.requestId,
    p_title: title,
    p_body: body,
  })
  if (!error && data) {
    return { id: String(data) }
  }
  if (!isMissingMessagesSchema(error)) {
    throw new ClientMessageError('Não foi possível enviar o aviso. Pode tentar novamente.', 503)
  }

  // Fallback via audit_log when the client_messages SQL migration has not yet been applied.
  const sourceKey = `manual:${scope.user}:${input.requestId}`
  const { data: priorRows, error: lookupError } = await db
    .from('audit_log')
    .select('id, details')
    .eq('tenant_id', scope.tenant)
    .eq('action', 'client_message')
    .eq('details->>client_id', scope.client)
    .eq('details->>source_key', sourceKey)
    .limit(1)

  if (lookupError) {
    throw new ClientMessageError('Não foi possível enviar o aviso. Pode tentar novamente.', 503)
  }
  if (priorRows && priorRows.length > 0) {
    const prior = (priorRows[0] as { id?: string; details?: Record<string, unknown> }).details || {}
    if (prior.title !== title || prior.body !== body) {
      throw new ClientMessageError('Não foi possível enviar o aviso. Pode tentar novamente.', 503)
    }
    const priorId = messageUuid(prior.id) ? prior.id : String((priorRows[0] as { id?: string }).id || '')
    return { id: priorId }
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const { error: insertError } = await db.from('audit_log').insert({
    tenant_id: scope.tenant,
    action: 'client_message',
    details: {
      id,
      client_id: scope.client,
      source_key: sourceKey,
      kind: 'info',
      title,
      body,
      section: null,
      reference: null,
      created_at: createdAt,
      sender_id: scope.user,
    },
  })
  if (insertError) {
    throw new ClientMessageError('Não foi possível enviar o aviso. Pode tentar novamente.', 503)
  }
  return { id }
}
