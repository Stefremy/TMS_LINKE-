import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { getFornecedoresAction } from "@/app/actions/fornecedores"
import { WebservicesClient } from "./components/WebservicesClient"

export const dynamic = "force-dynamic"

export default async function WebservicesPage() {
  const [connections, fornecedores] = await Promise.all([
    getCarrierConnectionsAction(),
    getFornecedoresAction(),
  ])

  return <WebservicesClient connections={connections || []} fornecedores={fornecedores || []} />
}

