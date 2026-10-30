'use client'

import { useEffect, useState } from 'react'
import { getClientTotalServicesAction } from '@/app/actions/client-service-history'

export function ClientServiceHistory({ clientId }: { clientId: string }) {
  const [history, setHistory] = useState<{total:number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    getClientTotalServicesAction(clientId).then(result => {
      if (current) { setHistory(result); setError(''); setLoading(false) }
    }).catch(() => {
      if (current) { setError('Não foi possível carregar o total de serviços.'); setLoading(false) }
    })
    return () => { current = false }
  }, [clientId, attempt])

  return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[var(--text-primary)]">N.º de serviços totais</span>
      <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
        {loading ? 'A carregar…' : error ? '—' : history ? history.total.toLocaleString('pt-PT') : '—'}
      </span>
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-[var(--status-critical)]">{error} <button type="button" className="underline" onClick={() => { setLoading(true); setError(''); setAttempt(n => n + 1) }}>Tentar novamente</button></p>}
  </div>
}
