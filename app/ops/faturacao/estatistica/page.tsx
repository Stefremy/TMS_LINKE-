import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { loadBillingStatistics } from "@/lib/billing/statistics-data"
import { BillingStatisticsClient } from "./BillingStatisticsClient"

export const dynamic = "force-dynamic"
export const metadata = { title: "Estatísticas de Faturação | Linke" }

export default async function EstatisticaPage() {
  await requireOpsPageAccess("/ops/faturacao/estatistica")

  const data = await loadBillingStatistics()
  return <BillingStatisticsClient data={data} />
}
