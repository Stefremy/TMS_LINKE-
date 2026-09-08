import { getClientesAction } from "@/app/actions/clientes"
import { ClientesClient } from "./components/ClientesClient"

export const dynamic = "force-dynamic"

export default async function EntidadesClientesPage() {
  const clientes = await getClientesAction()

  return <ClientesClient initialClientes={clientes} />
}
