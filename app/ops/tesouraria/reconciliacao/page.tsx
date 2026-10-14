import * as React from "react"
import { getReconciliacaoHistoryAction } from "@/app/actions/reconciliacao-ctt"
import ReconciliacaoClient from "./ReconciliacaoClient"
import { requireEmployee } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function ReconciliacaoPage() {
  const ctx = await requireEmployee()
  if (ctx.role !== "admin" && !ctx.permissions.includes("Faturação & Contas Correntes")) {
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
