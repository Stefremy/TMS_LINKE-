import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { NovoEnvioPageClient } from "./NovoEnvioPageClient"

export default async function NovoPage() {
  const [clients, servicosLinke] = await Promise.all([
    getClientesAction(),
    getServicosLinkeAction(),
  ])
  
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <NovoEnvioPageClient clients={clients} servicosLinke={servicosLinke} />
    </div>
  )
}
