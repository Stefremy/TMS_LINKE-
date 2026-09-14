import * as React from "react"
import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import { NovoEnvioPageClient } from "./NovoEnvioPageClient"

export default async function NovoPage() {
  const clients = await getClientesAction()
  const servicosLinke = await getServicosLinkeAction()
  
  return (
    <div className="bg-slate-100 min-h-[calc(100vh-4rem)]">
      <NovoEnvioPageClient clients={clients} servicosLinke={servicosLinke} />
    </div>
  )
}
