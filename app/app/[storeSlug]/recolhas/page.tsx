import { requirePortalStore } from "@/lib/client-portal/access"
import { listClientPickupRequestsAction } from "@/app/actions/client-pickup-requests"
import { listClientPickupLocationsAction } from "@/app/actions/client-pickup-locations"
import { ClientRequestPickup } from "../../components/ClientRequestPickup"

export const dynamic = "force-dynamic"

export default async function RecolhasPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { client } = await requirePortalStore((await params).storeSlug)
  const [result, agenda] = await Promise.all([
    listClientPickupRequestsAction({ clientId: client.id }),
    listClientPickupLocationsAction(client.id),
  ])
  return <ClientRequestPickup key={client.id}
    initialPage={result.success ? result : undefined} initialError={result.success ? undefined : result.error}
    initialLocations={agenda.success ? agenda.locations : undefined} initialDefaultLocationId={agenda.success ? agenda.defaultLocationId : null}
    agendaError={agenda.success ? undefined : agenda.error} />
}
