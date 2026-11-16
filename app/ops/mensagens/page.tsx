import Link from 'next/link'
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { notFound } from 'next/navigation'
import { requireEmployee } from '@/lib/auth/context'
import { getClientesAction } from '@/app/actions/clientes'
import { listSupportRequestsAction } from '@/app/actions/support-requests'
import { canSendClientMessages } from '@/lib/client-messages/types'
import { MessagesComposer } from './MessagesComposer'
import { SupportRequestsInbox } from './SupportRequestsInbox'
export const metadata = { title: 'Comunicação clientes | Linke TMS' }

export default async function ClientMessagesOpsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOpsPageAccess("/ops/mensagens")

  const ctx = await requireEmployee()
  if (!canSendClientMessages(ctx)) notFound()
  const tab = (await searchParams).tab === 'apoio' ? 'apoio' : 'avisos'
  const [clientes, requests] = await Promise.all([getClientesAction(), listSupportRequestsAction().catch(() => [])])
  const clients = clientes
    .map(client => ({ id: client.id, name: client.short_name || client.legal_name || 'Cliente', portalSlug: client.portal_slug || null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  const openCount = requests.filter(request => request.status === 'aberto').length
  const tabClass = (active: boolean) => `-mb-px border-b-2 px-1 pb-3 text-sm font-medium ${active ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Comunicação clientes</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Avisos para a Área do Cliente e pedidos de apoio enviados pelas lojas.</p>
        <nav aria-label="Separadores" className="mt-5 flex gap-6 border-b border-[var(--border-subtle)]">
          <Link href="/ops/mensagens" aria-current={tab === 'avisos' ? 'page' : undefined} className={tabClass(tab === 'avisos')}>Avisos</Link>
          <Link href="/ops/mensagens?tab=apoio" aria-current={tab === 'apoio' ? 'page' : undefined} className={tabClass(tab === 'apoio')}>
            Pedidos de apoio{openCount > 0 && <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">{openCount}</span>}
          </Link>
        </nav>
      </header>
      {tab === 'apoio' ? <SupportRequestsInbox requests={requests} clients={clients} /> : <MessagesComposer clients={clients} />}
    </div>
  )
}
