import { getRelatoriosDataAction } from "@/app/actions/relatorios"
import { RelatoriosClient } from "./components/RelatoriosClient"

export const dynamic = "force-dynamic"

export default async function RelatoriosPage() {
  const data = await getRelatoriosDataAction("este_mes")

  return <RelatoriosClient initialData={data} />
}
