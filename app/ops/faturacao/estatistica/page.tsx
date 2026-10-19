import { loadBillingStatistics } from "@/lib/billing/statistics-data"
import { BillingStatisticsClient } from "./BillingStatisticsClient"

export const dynamic = "force-dynamic"
export const metadata = { title: "Estatísticas de Faturação | Linke" }

export default async function EstatisticaPage() {
  const data = await loadBillingStatistics()
  return <BillingStatisticsClient data={data} />
}
