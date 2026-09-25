import * as React from "react"
import { getIntegrations } from "@/app/actions/integracoes"
import { IntegracoesClient } from "./IntegracoesClient"

export const metadata = {
  title: "Integrações & Conexões | Linke TMS",
  description: "Gestão de credenciais e integrações de transporte Linke TMS",
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }> | { saved?: string }
}) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {}
  const integrations = await getIntegrations()

  return (
    <IntegracoesClient 
      integrations={integrations}
      savedNotification={resolvedParams?.saved === "true"}
    />
  )
}
