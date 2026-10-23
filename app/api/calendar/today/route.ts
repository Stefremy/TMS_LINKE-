import { getAuthContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { lisbonDate } from '@/lib/billing/recurring-periods'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }

export async function GET() {
  const context = await getAuthContext()
  if (!context) return Response.json({ error: 'Inicie sessão para consultar o calendário.' }, { status: 401, headers })
  if (context.role !== 'employee' && context.role !== 'admin') {
    return Response.json({ error: 'Sem acesso ao calendário da equipa.' }, { status: 403, headers })
  }
  const date = lisbonDate()
  try {
    // Same user-scoped/RLS source as the team calendar. Return only today's compact summary.
    const db = await createClient()
    const { data, count, error } = await db.from('calendar_events').select('title,time', { count: 'exact' })
      .eq('event_date', date).order('time', { ascending: true, nullsFirst: true }).order('id').limit(1)
    if (error || count == null) throw new Error('Calendar unavailable')
    const first = data?.[0]
    return Response.json({ date, total: count, event: first ? { title: first.title, time: first.time || null } : null }, { headers })
  } catch {
    return Response.json({ date, error: 'Não foi possível consultar os eventos.' }, { status: 503, headers })
  }
}
