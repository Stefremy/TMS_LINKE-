import { notFound } from 'next/navigation'
import { requireEmployee } from '@/lib/auth/context'
import { getClientesAction } from '@/app/actions/clientes'
import { canSendClientMessages } from '@/lib/client-messages/types'
import { MessagesComposer } from './MessagesComposer'
export const metadata = { title: 'Mensagens aos clientes | Linke TMS' }
export default async function ClientMessagesOpsPage() {
  const ctx = await requireEmployee()
  if (!canSendClientMessages(ctx)) notFound()
  const clients = await getClientesAction()
  return (
    <MessagesComposer
      clients={clients
        .map(client => ({
          id: client.id,
          name: client.short_name || client.legal_name || 'Cliente',
          portalSlug: client.portal_slug || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt'))}
    />
  )
}
