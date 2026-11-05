import { requirePortalStore } from "@/lib/client-portal/access"
import { getShipmentQuotationsAction } from "@/app/actions/shipment-quotations"
import { QuoteRequestsClient } from "@/components/shipments/quotations/QuoteRequestsClient"
import type { QuotationPage } from "@/lib/shipments/quotations/types"

export default async function ClientQuotationsPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params
  const { client } = await requirePortalStore(storeSlug)
  let initial: QuotationPage = { requests: [], next: null }, error = ""
  try { initial = await getShipmentQuotationsAction(client.id, undefined, true) }
  catch { error = "Não foi possível carregar as cotações. Tente atualizar." }
  return <QuoteRequestsClient mode="client" basePath={`/app/${storeSlug}`} clientId={client.id} initial={initial} initialError={error} />
}
