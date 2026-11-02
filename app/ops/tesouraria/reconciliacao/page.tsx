import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import * as React from "react"
import { getReconciliacaoHistoryAction } from "@/app/actions/reconciliacao-ctt"
import ReconciliacaoClient from "./ReconciliacaoClient"
import { requireEmployee } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function ReconciliacaoPage() {
  await requireOpsPageAccess("/ops/tesouraria/reconciliacao")

  const ctx = await requireEmployee()
  if (!hasPermission(ctx, PERMISSIONS.finance)) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p>Esta área requer permissão de Faturação &amp; Contas Correntes. Contacte um administrador para solicitar acesso.</p>
      </div>
    )
  }
  const history = await getReconciliacaoHistoryAction()

  return (
    <div className="space-y-6">
      <ReconciliacaoClient initialHistory={history} />
    </div>
  )
}
