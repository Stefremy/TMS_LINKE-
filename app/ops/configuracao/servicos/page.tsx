import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import * as React from "react"
import { getServicosDashboardDataAction } from "@/app/actions/servicos-linke"
import { ServicosLinkeClient } from "./components/ServicosLinkeClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ServicosPage() {
  await requireOpsPageAccess("/ops/configuracao/servicos")

  const dashboardData = await getServicosDashboardDataAction()

  const { servicos, fornecedores, webservices, canManageBaseTables, canManageCreatedTables } = dashboardData

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <ServicosLinkeClient
        initialServicos={servicos}
        initialFornecedores={fornecedores}
        initialWebservices={webservices || []}
        canManageBaseTables={canManageBaseTables}
        canManageCreatedTables={canManageCreatedTables}
      />
    </div>
  )
}
