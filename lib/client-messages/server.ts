import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import { canSendClientMessages, ClientMessageError, messageText, messageUuid, type MessagePage } from './types'

export async function authorizeMessageClient(db: SupabaseClient, ctx: AuthContext | null, clientId: string) {
  if (!ctx?.user?.id || !ctx.tenant_id || !['client', 'employee', 'admin'].includes(ctx.role || '')) throw new ClientMessageError('Inicie sessão para consultar as mensagens.', 401)
  if (!messageUuid(clientId) || ctx.role === 'client' && ctx.client_id !== clientId) throw new ClientMessageError('Sem acesso a estas mensagens.', 403)
  const { data, error } = await db.from('clients').select('id').eq('tenant_id', ctx.tenant_id).eq('id', clientId).maybeSingle()
  if (error) throw new ClientMessageError('Não foi possível verificar o acesso às mensagens.', 503)
  if (!data) throw new ClientMessageError('Sem acesso a estas mensagens.', 403)
  return { tenant: ctx.tenant_id, client: clientId, user: String(ctx.user.id) }
}
export async function listClientMessages(db: SupabaseClient, ctx: AuthContext | null, clientId: string, params: URLSearchParams): Promise<MessagePage> {
  const scope = await authorizeMessageClient(db, ctx, clientId)
  const at = params.get('before'), id = params.get('beforeId')
  if (!!at !== !!id || at && (!Number.isFinite(Date.parse(at)) || !messageUuid(id))) throw new ClientMessageError('Página de mensagens inválida.')
  const { data, error } = await db.rpc('client_message_page', {
    p_tenant: scope.tenant, p_client: scope.client, p_user: scope.user,
    p_before: at, p_before_id: id, p_unread: params.get('unread') === '1', p_limit: params.get('summary') === '1' ? 0 : 20,
  })
  if (error || !data) throw new ClientMessageError('Não foi possível carregar as mensagens. Tente novamente.', 503)
  return data as MessagePage
}
export async function markClientMessagesRead(db: SupabaseClient, ctx: AuthContext | null, clientId: string, ids: unknown) {
  const scope = await authorizeMessageClient(db, ctx, clientId)
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => !messageUuid(id))) throw new ClientMessageError('Seleção de mensagens inválida.')
  const { error } = await db.rpc('mark_client_messages_read', { p_tenant: scope.tenant, p_client: scope.client, p_user: scope.user, p_ids: [...new Set(ids)] })
  if (error) throw new ClientMessageError('Não foi possível marcar as mensagens como lidas.', 503)
}
export async function sendClientMessage(db: SupabaseClient, ctx: AuthContext | null, input: Record<string, unknown>) {
  if (!canSendClientMessages(ctx)) throw new ClientMessageError('Sem permissão para enviar avisos aos clientes.', 403)
  const scope = await authorizeMessageClient(db, ctx, String(input.clientId || ''))
  const title = messageText(input.title, 160), body = messageText(input.body, 4000)
  if (!messageUuid(input.requestId)) throw new ClientMessageError('Pedido de envio inválido.')
  const { data, error } = await db.rpc('send_client_message', { p_tenant: scope.tenant, p_client: scope.client, p_user: scope.user,
    p_request: input.requestId, p_title: title, p_body: body })
  if (error || !data) throw new ClientMessageError('Não foi possível enviar o aviso. Pode tentar novamente.', 503)
  return { id: String(data) }
}
