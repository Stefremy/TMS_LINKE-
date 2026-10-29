import { getAuthContext } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { ClientMessageError } from '@/lib/client-messages/types'
import { listClientAnnouncements, publishClientAnnouncement, withdrawClientAnnouncement } from '@/lib/client-messages/announcements-server'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })
const failure = (error: unknown) => error instanceof ClientMessageError ? reply({ error: error.message }, error.status)
  : reply({ error: 'Não foi possível processar o comunicado. Tente novamente.' }, 503)
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return reply({ error: 'Inicie sessão.' }, 401)
    const params = new URL(request.url).searchParams
    return reply(await listClientAnnouncements(createAdminClient(), ctx, params.get('clientId') || '', params.get('manage') === '1'))
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Origem não autorizada.' }, 403)
  try {
    const ctx = await getAuthContext()
    if (!ctx) return reply({ error: 'Inicie sessão.' }, 401)
    const raw = await request.text()
    if (raw.length > 20000) return reply({ error: 'Comunicado demasiado longo.' }, 400)
    let input: Record<string, unknown>
    try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); input = value }
    catch { return reply({ error: 'Pedido inválido.' }, 400) }
    if (input.action === 'publish') return reply(await publishClientAnnouncement(createAdminClient(), ctx, input))
    if (input.action === 'withdraw') return reply(await withdrawClientAnnouncement(createAdminClient(), ctx, input.id))
    return reply({ error: 'Ação inválida.' }, 400)
  } catch (error) { return failure(error) }
}
