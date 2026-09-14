import { getDestinatariosAction } from "@/app/actions/destinatarios"
import { getClientesAction } from "@/app/actions/clientes"
import { DestinatariosClient } from "./components/DestinatariosClient"

export const dynamic = "force-dynamic"

export default async function DestinatariosPage() {
  const [destinatarios, clientes] = await Promise.all([
    getDestinatariosAction(),
    getClientesAction(),
  ])

  return (
    <DestinatariosClient
      initialDestinatarios={destinatarios || []}
      clients={clientes || []}
    />
  )
}
