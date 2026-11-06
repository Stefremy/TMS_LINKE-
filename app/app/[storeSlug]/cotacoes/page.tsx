import { requirePortalStore } from "@/lib/client-portal/access"
import { getShipmentQuotationsAction } from "@/app/actions/shipment-quotations"
import { InternationalAirRequestsClient } from "@/components/shipments/quotations/InternationalAirRequestsClient"
import type { QuotationPage } from "@/lib/shipments/quotations/types"

export default async function ClientQuotationsPage({ params, searchParams }: {
  params: Promise<{ storeSlug: string }>
  searchParams: Promise<{ pedido?: string | string[] }>
}) {
  const { storeSlug } = await params
  const { client } = await requirePortalStore(storeSlug)
  const { pedido } = await searchParams
  let initial: QuotationPage = { requests: [], next: null }, error = ""
  try { initial = await getShipmentQuotationsAction(client.id, undefined, true) }
  catch { error = "Não foi possível carregar os pedidos. Tente atualizar." }
  return <InternationalAirRequestsClient key={client.id} initial={initial} initialError={error} selectedId={typeof pedido === "string" ? pedido : undefined} />
}
