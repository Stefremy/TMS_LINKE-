import { requirePortalStore } from '@/lib/client-portal/access'
import { getClientReembolsosAction } from '@/app/actions/client-reembolsos'
import { ClientReembolsos } from '../../components/ClientReembolsos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reembolsos | Linke' }
export default async function ReembolsosPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { client } = await requirePortalStore((await params).storeSlug)
  const result = await getClientReembolsosAction(client.id).then(data => ({ data, error: '' }))
    .catch(() => ({ data: null, error: 'Não foi possível carregar os seus reembolsos. Tente atualizar os dados.' }))
  return <ClientReembolsos key={client.id} overview={result.data} error={result.error} />
}
