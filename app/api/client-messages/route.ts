import { getAuthContext } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { ClientMessageError } from '@/lib/client-messages/types'
import { listClientMessages, markClientMessagesRead, sendClientMessage } from '@/lib/client-messages/server'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })
const failure = (error: unknown) => error instanceof ClientMessageError ? reply({ error: error.message }, error.status)
  : reply({ error: 'Não foi possível processar as mensagens. Tente novamente.' }, 503)
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return reply({ error: 'Inicie sessão para consultar as mensagens.' }, 401)
    const params = new URL(request.url).searchParams
    return reply(await listClientMessages(createAdminClient(), ctx, params.get('clientId') || '', params))
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Origem não autorizada.' }, 403)
  try {
    const ctx = await getAuthContext()
    if (!ctx) return reply({ error: 'Inicie sessão para gerir as mensagens.' }, 401)
    const raw = await request.text()
    if (raw.length > 12000) return reply({ error: 'Mensagem demasiado longa.' }, 400)
    let body: Record<string, unknown>
    try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); body = parsed }
    catch { return reply({ error: 'Pedido inválido.' }, 400) }
    const db = createAdminClient()
    if (body.action === 'read') { await markClientMessagesRead(db, ctx, String(body.clientId || ''), body.ids); return reply({ success: true }) }
    if (body.action === 'send') return reply(await sendClientMessage(db, ctx, body))
    return reply({ error: 'Ação inválida.' }, 400)
  } catch (error) { return failure(error) }
}
