import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getShipmentQuotationsAction } from "@/app/actions/shipment-quotations"
import { QuoteRequestsClient } from "@/components/shipments/quotations/QuoteRequestsClient"
import type { QuotationPage } from "@/lib/shipments/quotations/types"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

export default async function ShipmentQuotationsPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const ctx = await requireOpsPageAccess("/ops/envios/cotacoes")
  let initial: QuotationPage = { requests: [], next: null }, error = ""
  try { initial = await getShipmentQuotationsAction() }
  catch { error = "Não foi possível carregar as cotações. Tente atualizar." }
  return <QuoteRequestsClient mode="ops" basePath="/ops" initial={initial} initialError={error} selectedId={(await searchParams).pedido} canRecordBooking={hasPermission(ctx, PERMISSIONS.shipments)} />
}
