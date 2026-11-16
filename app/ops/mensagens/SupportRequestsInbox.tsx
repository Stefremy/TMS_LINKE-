'use client'

import { useMemo, useState, useTransition } from 'react'
import { Inbox, Loader2 } from 'lucide-react'
import { setSupportRequestStatusAction } from '@/app/actions/support-requests'
import { SUPPORT_REQUESTS_CHANGED_EVENT, SUPPORT_STATUS_LABEL, supportCategoryLabel, type SupportRequest, type SupportStatus } from '@/lib/support-requests/types'

const statusStyle: Record<SupportStatus, string> = {
  aberto: 'bg-amber-50 text-amber-800 border-amber-200',
  em_curso: 'bg-sky-50 text-sky-800 border-sky-200',
  resolvido: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}
const filters: { id: SupportStatus | 'todos'; label: string }[] = [
  { id: 'aberto', label: 'Abertos' }, { id: 'em_curso', label: 'Em curso' }, { id: 'resolvido', label: 'Resolvidos' }, { id: 'todos', label: 'Todos' },
]
const date = (value: string) => new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

export function SupportRequestsInbox({ requests: initial, clients }: { requests: SupportRequest[]; clients: { id: string; name: string }[] }) {
  const [requests, setRequests] = useState(initial)
  const [filter, setFilter] = useState<SupportStatus | 'todos'>('aberto')
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const names = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients])
  const visible = filter === 'todos' ? requests : requests.filter(request => request.status === filter)

  const update = (id: string, status: SupportStatus) => {
    setError(''); setPendingId(id)
    startTransition(async () => {
      try {
        const result = await setSupportRequestStatusAction(id, status)
        if (!result.success) { setError(result.error || 'Não foi possível atualizar o estado.'); return }
        setRequests(previous => previous.map(request => request.id === id ? { ...request, status, statusUpdatedAt: new Date().toISOString() } : request))
        window.dispatchEvent(new Event(SUPPORT_REQUESTS_CHANGED_EVENT))
      } catch { setError('Não foi possível atualizar o estado.') }
      finally { setPendingId(null) }
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar pedidos">
        {filters.map(item => {
          const count = item.id === 'todos' ? requests.length : requests.filter(request => request.status === item.id).length
          return <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            {item.label} <span className="tabular-nums">({count})</span>
          </button>
        })}
      </div>
      {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {!visible.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-secondary)]">
          <Inbox className="h-6 w-6 text-[var(--text-tertiary)]" />Sem pedidos nesta vista.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(request => (
            <li key={request.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">{names.get(request.clientId) || 'Cliente'} · {supportCategoryLabel(request.category)}</p>
                  <h3 className="mt-0.5 break-words text-sm font-semibold text-[var(--text-primary)]">{request.subject}</h3>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[request.status]}`}>{SUPPORT_STATUS_LABEL[request.status]}</span>
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-sm text-[var(--text-primary)]">{request.description}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                <div><dt className="inline">Recebido: </dt><dd className="inline text-[var(--text-primary)]">{date(request.createdAt)}</dd></div>
                {request.issueDate && <div><dt className="inline">Data do problema: </dt><dd className="inline text-[var(--text-primary)]">{new Date(`${request.issueDate}T12:00:00`).toLocaleDateString('pt-PT')}</dd></div>}
                {request.shipmentRef && <div><dt className="inline">Envio: </dt><dd className="inline font-mono text-[var(--text-primary)]">{request.shipmentRef}</dd></div>}
                {(request.contact || request.createdByEmail) && <div className="break-all"><dt className="inline">Contacto: </dt><dd className="inline text-[var(--text-primary)]">{request.contact || request.createdByEmail}</dd></div>}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                {pendingId === request.id && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />}
                {(['aberto', 'em_curso', 'resolvido'] as SupportStatus[]).filter(status => status !== request.status).map(status => (
                  <button key={status} type="button" disabled={pendingId === request.id} onClick={() => update(request.id, status)}
                    className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-60">
                    Marcar como {SUPPORT_STATUS_LABEL[status].toLowerCase()}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
