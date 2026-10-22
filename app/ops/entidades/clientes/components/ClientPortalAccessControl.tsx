'use client'

import { useEffect, useState } from 'react'
import { LockKeyhole, UnlockKeyhole, Loader2 } from 'lucide-react'
import { getClientPortalAccessAction, setClientPortalBlockedAction } from '@/app/actions/client-portal-access'

export function ClientPortalAccessPanel({ blocked, pending, confirming, onToggle, onCancel }: {
  blocked: boolean; pending: boolean; confirming: boolean; onToggle: () => void; onCancel: () => void
}) {
  return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Acesso à Área do Cliente <span className={`ml-2 text-xs font-medium ${blocked ? 'text-[#b13b35]' : 'text-[var(--text-secondary)]'}`}>{blocked ? 'Suspenso' : 'Ativo'}</span></p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{blocked ? 'O cliente verá um aviso para contactar geral@linke.pt.' : 'Pode suspender o acesso sem alterar os dados comerciais.'}</p>
      </div>
      <button type="button" disabled={pending} onClick={onToggle} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${blocked ? 'border-[var(--border-subtle)] text-[var(--accent)] hover:bg-[var(--surface-muted)]' : 'border-[#b13b35] text-[#b13b35] hover:bg-[#b13b35]/5'}`}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : blocked ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
        {pending ? 'A atualizar…' : blocked ? 'Reativar Cliente' : confirming ? 'Confirmar bloqueio' : 'Bloquear Cliente'}
      </button>
    </div>
    {confirming && !blocked && <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs leading-5 text-[var(--text-secondary)]">
      O cliente deixará de poder aceder à sua conta. Pode reativar o acesso aqui a qualquer momento.
      <button type="button" disabled={pending} onClick={onCancel} className="ml-2 font-semibold underline underline-offset-2">Cancelar</button>
    </div>}
  </div>
}

export function ClientPortalAccessControl({ clientId, disabled = false }: { clientId: string; disabled?: boolean }) {
  const [blocked, setBlocked] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(0)
  useEffect(() => {
    let current = true
    getClientPortalAccessAction(clientId).then(result => { if (current) { setBlocked(result.blocked); setError('') } })
      .catch(() => { if (current) setError('Não foi possível verificar o acesso do cliente.') })
    return () => { current = false }
  }, [clientId, loaded])

  async function toggle() {
    if (pending || disabled || blocked === null) return
    if (!blocked && !confirming) { setConfirming(true); return }
    setPending(true)
    setError('')
    try {
      const result = await setClientPortalBlockedAction(clientId, !blocked)
      setBlocked(result.blocked)
      setConfirming(false)
    } catch { setError('Não foi possível alterar o acesso. Tente novamente.') }
    finally { setPending(false) }
  }
  return <div className="mt-5">
    {blocked === null ? <p className="text-xs text-[var(--text-secondary)]">{error || 'A verificar acesso…'}{error && <button type="button" onClick={() => setLoaded(n => n + 1)} className="ml-2 underline">Tentar novamente</button>}</p>
      : <><ClientPortalAccessPanel blocked={blocked} pending={pending || disabled} confirming={confirming} onToggle={toggle} onCancel={() => setConfirming(false)} />
        {error && <p role="alert" className="mt-2 text-xs text-[#b13b35]">{error}</p>}
        <p aria-live="polite" className="sr-only">{blocked ? 'Acesso do cliente suspenso.' : 'Acesso do cliente ativo.'}</p></>}
  </div>
}
