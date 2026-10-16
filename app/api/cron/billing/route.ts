import { NextResponse } from 'next/server'
import { runRecurringStatements } from '@/lib/billing/recurring-statements'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Scheduled closed-period Moloni invoices, followed by invoice and statement email delivery. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // A query parameter must never bypass closed-period checks.
  if (new URL(request.url).searchParams.has('force')) {
    return NextResponse.json({ error: 'Use a pré-visualização para simular períodos.' }, { status: 400 })
  }
  try {
    const result = await runRecurringStatements()
    return NextResponse.json({ success: result.errors.length === 0, ...result }, {
      status: result.errors.length ? 207 : 200, headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível processar os extratos automáticos.' }, { status: 500 })
  }
}

export async function POST(request: Request) { return GET(request) }
