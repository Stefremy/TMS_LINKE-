import * as React from "react"
import { getDestinatariosAction } from "@/app/actions/destinatarios"
import { getClientesAction } from "@/app/actions/clientes"
import { requireUser } from "@/lib/auth/context"
import { DestinatariosClient } from "@/app/ops/entidades/destinatarios/components/DestinatariosClient"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ClientDestinatariosPage() {
  const ctx = await requireUser()
  if (!ctx.client_id) {
    redirect("/ops/entidades/destinatarios")
  }

  const [destinatarios, clients] = await Promise.all([
    getDestinatariosAction(ctx.client_id),
    getClientesAction(ctx.client_id),
  ])

  return (
    <DestinatariosClient
      initialDestinatarios={destinatarios || []}
      clients={clients || []}
      lockedClientId={ctx.client_id}
    />
  )
}
