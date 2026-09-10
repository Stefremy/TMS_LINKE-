import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { ClientesClient } from "./components/ClientesClient"

export const dynamic = "force-dynamic"

export default async function EntidadesClientesPage() {
  const [clientes, servicosLinke] = await Promise.all([
    getClientesAction(),
    getServicosLinkeAction(),
  ])

  return (
    <ClientesClient 
      initialClientes={clientes} 
      initialServicosLinke={servicosLinke} 
    />
  )
}
