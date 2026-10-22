'use client'

import { useEffect, useState } from 'react'
import { LockKeyhole, UnlockKeyhole, Loader2, PauseCircle, PlayCircle } from 'lucide-react'
import {
  getClientPortalAccessAction,
  setClientPortalBlockedAction,
  setClientPortalSuspendedAction,
} from '@/app/actions/client-portal-access'

export function ClientPortalAccessPanel({
  blocked,
  suspended = false,
  pending,
  confirmingBlock,
  confirmingSuspend,
  onToggleBlock,
  onToggleSuspend,
  onCancel,
}: {
  blocked: boolean
  suspended?: boolean
  pending: boolean
  confirmingBlock: boolean
  confirmingSuspend: boolean
  onToggleBlock: () => void
  onToggleSuspend: () => void
  onCancel: () => void
}) {
  const statusLabel = blocked ? 'Bloqueado' : suspended ? 'Suspenso (Apenas Consulta)' : 'Ativo'
  const statusBadgeColor = blocked ? 'text-[#b13b35]' : suspended ? 'text-amber-700' : 'text-[var(--text-secondary)]'

  const subtitleText = blocked
    ? 'O cliente verá um aviso para contactar geral@linke.pt.'
    : suspended
    ? 'O cliente pode aceder à área do cliente mas não criar novos envios.'
    : 'Pode suspender o acesso sem alterar os dados comerciais.'

  return (
    <div className="space-y-4">
      {/* 1. Bloqueio Total de Acesso */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-2xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Acesso à Área do Cliente <span className={`ml-2 text-xs font-medium ${statusBadgeColor}`}>{statusLabel}</span>
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{subtitleText}</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onToggleBlock}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 cursor-pointer ${
              blocked
                ? 'border-[var(--border-subtle)] text-[var(--accent)] hover:bg-[var(--surface-muted)]'
                : 'border-[#b13b35] text-[#b13b35] hover:bg-[#b13b35]/5'
            }`}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : blocked ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
            {pending ? 'A atualizar…' : blocked ? 'Reativar Cliente' : confirmingBlock ? 'Confirmar bloqueio' : 'Bloquear Cliente'}
          </button>
        </div>
        {confirmingBlock && !blocked && (
          <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs leading-5 text-[var(--text-secondary)]">
            O cliente deixará de poder aceder à sua conta. Pode reativar o acesso aqui a qualquer momento.
            <button type="button" disabled={pending} onClick={onCancel} className="ml-2 font-semibold underline underline-offset-2 cursor-pointer">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* 2. Suspensão de Criação de Envios */}
      {!blocked && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-2xs">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Suspensão de Novos Envios</p>
                {suspended && (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Envios Bloqueados
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Em suspensão o cliente pode aceder à área do cliente para consultar faturas, envios e tracking, mas não criar novos envios.
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={onToggleSuspend}
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 cursor-pointer ${
                suspended
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-amber-600 text-amber-800 hover:bg-amber-50'
              }`}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : suspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
              {pending ? 'A atualizar…' : suspended ? 'Reativar Envios' : confirmingSuspend ? 'Confirmar suspensão' : 'Suspender Cliente'}
            </button>
          </div>
          {confirmingSuspend && !suspended && (
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs leading-5 text-[var(--text-secondary)]">
              O cliente continuará a aceder à Área do Cliente normalmente, mas o formulário de emissão de novos envios ficará bloqueado.
              <button type="button" disabled={pending} onClick={onCancel} className="ml-2 font-semibold underline underline-offset-2 cursor-pointer">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ClientPortalAccessControl({ clientId, disabled = false }: { clientId: string; disabled?: boolean }) {
  const [blocked, setBlocked] = useState<boolean | null>(null)
  const [suspended, setSuspended] = useState<boolean>(false)
  const [pending, setPending] = useState(false)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [confirmingSuspend, setConfirmingSuspend] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(0)

  useEffect(() => {
    let current = true
    getClientPortalAccessAction(clientId)
      .then(result => {
        if (current) {
          setBlocked(Boolean(result.blocked))
          setSuspended(Boolean(result.suspended))
          setError('')
        }
      })
      .catch(() => {
        if (current) setError('Não foi possível verificar o acesso do cliente.')
      })
    return () => { current = false }
  }, [clientId, loaded])

  async function toggleBlock() {
    if (pending || disabled || blocked === null) return
    if (!blocked && !confirmingBlock) {
      setConfirmingBlock(true)
      setConfirmingSuspend(false)
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await setClientPortalBlockedAction(clientId, !blocked)
      setBlocked(result.blocked)
      if (result.blocked) setSuspended(false)
      setConfirmingBlock(false)
    } catch {
      setError('Não foi possível alterar o acesso. Tente novamente.')
    } finally {
      setPending(false)
    }
  }

  async function toggleSuspend() {
    if (pending || disabled || blocked) return
    if (!suspended && !confirmingSuspend) {
      setConfirmingSuspend(true)
      setConfirmingBlock(false)
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await setClientPortalSuspendedAction(clientId, !suspended)
      setSuspended(result.suspended)
      setConfirmingSuspend(false)
    } catch {
      setError('Não foi possível alterar a suspensão. Tente novamente.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2">
      {blocked === null ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {error || 'A verificar acesso…'}
          {error && (
            <button type="button" onClick={() => setLoaded(n => n + 1)} className="ml-2 underline cursor-pointer">
              Tentar novamente
            </button>
          )}
        </p>
      ) : (
        <>
          <ClientPortalAccessPanel
            blocked={blocked}
            suspended={suspended}
            pending={pending || disabled}
            confirmingBlock={confirmingBlock}
            confirmingSuspend={confirmingSuspend}
            onToggleBlock={toggleBlock}
            onToggleSuspend={toggleSuspend}
            onCancel={() => {
              setConfirmingBlock(false)
              setConfirmingSuspend(false)
            }}
          />
          {error && <p role="alert" className="mt-2 text-xs text-[#b13b35]">{error}</p>}
          <p aria-live="polite" className="sr-only">
            {blocked ? 'Acesso do cliente bloqueado.' : suspended ? 'Criação de envios suspensa.' : 'Acesso do cliente ativo.'}
          </p>
        </>
      )}
    </div>
  )
}
