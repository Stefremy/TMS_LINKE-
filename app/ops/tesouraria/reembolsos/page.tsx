import * as React from "react"
import { getReembolsoBatchesAction } from "@/app/actions/reembolsos"
import ReembolsosClient from "./ReembolsosClient"
import { requireEmployee } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export default async function ReembolsosPage() {
  const ctx = await requireEmployee()
  if (ctx.role !== "admin" && !ctx.permissions.includes("Faturação & Contas Correntes")) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p>Esta área requer permissão de Faturação &amp; Contas Correntes. Contacte um administrador para solicitar acesso.</p>
      </div>
    )
  }
  const batches = await getReembolsoBatchesAction()

  return (
    <div className="space-y-6">
      <ReembolsosClient initialBatches={batches} />
    </div>
  )
}
