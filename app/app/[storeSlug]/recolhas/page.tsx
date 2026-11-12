import { requirePortalStore } from "@/lib/client-portal/access"
import { listClientPickupRequestsAction } from "@/app/actions/client-pickup-requests"
import { ClientRequestPickup } from "../../components/ClientRequestPickup"

export const dynamic = "force-dynamic"

export default async function RecolhasPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { client } = await requirePortalStore((await params).storeSlug)
  const result = await listClientPickupRequestsAction({ clientId: client.id })
  return <ClientRequestPickup key={client.id} initialPage={result.success ? result : undefined} initialError={result.success ? undefined : result.error} />
}
