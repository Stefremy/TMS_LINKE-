import * as React from "react"
import { getDestinatariosAction } from "@/app/actions/destinatarios"
import { requirePortalStore } from "@/lib/client-portal/access"
import { DestinatariosClient } from "@/app/ops/entidades/destinatarios/components/DestinatariosClient"

export const dynamic = "force-dynamic"

export default async function ClientDestinatariosPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { client } = await requirePortalStore((await params).storeSlug)
  const destinatarios = await getDestinatariosAction(client.id)

  return (
    <DestinatariosClient
      initialDestinatarios={destinatarios || []}
      clients={[client]}
      lockedClientId={client.id}
    />
  )
}
