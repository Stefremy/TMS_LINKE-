import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getRelatoriosDataAction } from "@/app/actions/relatorios"
import { RelatoriosClient } from "./components/RelatoriosClient"

export const dynamic = "force-dynamic"

export default async function RelatoriosPage() {
  await requireOpsPageAccess("/ops/relatorios")

  const data = await getRelatoriosDataAction("este_mes")

  return <RelatoriosClient initialData={data} />
}
