import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { getFornecedoresAction } from "@/app/actions/fornecedores"
import { WebservicesClient } from "./components/WebservicesClient"

export const dynamic = "force-dynamic"

export default async function WebservicesPage() {
  await requireOpsPageAccess("/ops/configuracao/webservices")

  const [connections, fornecedores] = await Promise.all([
    getCarrierConnectionsAction(),
    getFornecedoresAction(),
  ])

  return <WebservicesClient connections={connections || []} fornecedores={fornecedores || []} />
}

