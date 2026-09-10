import * as React from "react"
import { getServicosDashboardDataAction } from "@/app/actions/servicos-linke"
import { ServicosLinkeClient } from "./components/ServicosLinkeClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ServicosPage() {
  const { servicos, fornecedores, webservices } = await getServicosDashboardDataAction()

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <ServicosLinkeClient
        initialServicos={servicos}
        initialFornecedores={fornecedores}
        initialWebservices={webservices || []}
      />
    </div>
  )
}
