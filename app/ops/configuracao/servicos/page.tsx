import * as React from "react"
import { getServicosDashboardDataAction } from "@/app/actions/servicos-linke"
import { getAuthContext } from "@/lib/auth/context"
import { ServicosLinkeClient } from "./components/ServicosLinkeClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ServicosPage() {
  const [dashboardData, authCtx] = await Promise.all([
    getServicosDashboardDataAction(),
    getAuthContext(),
  ])

  const isStefano = Boolean(
    authCtx?.user?.email?.toLowerCase().includes("stefano") ||
    authCtx?.colaborador_id === "col-stefano-001"
  )

  const { servicos, fornecedores, webservices } = dashboardData

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <ServicosLinkeClient
        initialServicos={servicos}
        initialFornecedores={fornecedores}
        initialWebservices={webservices || []}
        canDeletePrimordial={isStefano}
      />
    </div>
  )
}
