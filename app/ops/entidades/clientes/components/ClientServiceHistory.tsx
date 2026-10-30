'use client'

import { useEffect, useState } from 'react'
import { getClientServiceHistoryAction } from '@/app/actions/client-service-history'
import type { LegacyServiceHistory } from '@/lib/clients/service-history'

export function ClientServiceHistory({ clientId }: { clientId: string }) {
  const [history, setHistory] = useState<LegacyServiceHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    getClientServiceHistoryAction(clientId).then(result => {
      if (current) { setHistory(result); setError(''); setLoading(false) }
    }).catch(() => {
      if (current) { setError('Não foi possível carregar o histórico de serviços.'); setLoading(false) }
    })
    return () => { current = false }
  }, [clientId, attempt])

  return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[var(--text-primary)]">Serviços na plataforma anterior</span>
      <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">
        {loading ? 'A carregar…' : error ? '—' : history ? history.count.toLocaleString('pt-PT') : 'Sem dados importados'}
      </span>
    </div>
    {error ? <p role="alert" className="mt-1 text-xs text-[var(--status-critical)]">{error} <button type="button" className="underline" onClick={() => { setLoading(true); setError(''); setAttempt(n => n + 1) }}>Tentar novamente</button></p>
      : !loading && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
        {history ? `Histórico importado em ${new Date(history.imported_at).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' })}. ${history.period_end ? `Contabilizado até ${new Date(history.period_end).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' })}.` : 'Período não indicado no ficheiro.'} Contagem apresentada separadamente dos envios do TMS.` : 'Não existe uma contagem associada a esta ficha.'}
      </p>}
  </div>
}
