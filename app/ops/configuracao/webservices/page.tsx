import { getCarrierConnectionsAction } from "@/app/actions/ctt"
import { WebservicesClient } from "./components/WebservicesClient"

export default async function WebservicesPage() {
  const connections = await getCarrierConnectionsAction()

  return <WebservicesClient connections={connections || []} />
}
