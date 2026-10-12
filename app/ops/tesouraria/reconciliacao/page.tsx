import * as React from "react"
import { getReconciliacaoHistoryAction } from "@/app/actions/reconciliacao-ctt"
import ReconciliacaoClient from "./ReconciliacaoClient"

export const dynamic = "force-dynamic"

export default async function ReconciliacaoPage() {
  const history = await getReconciliacaoHistoryAction()

  return (
    <div className="space-y-6">
      <ReconciliacaoClient initialHistory={history} />
    </div>
  )
}
