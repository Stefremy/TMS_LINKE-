import * as React from "react"
import { getSalariosAction } from "@/app/actions/salarios"
import { SalariosClient } from "./components/SalariosClient"
import { SalariosRestrictedAccess } from "./components/SalariosRestrictedAccess"
import { getAuthContext } from "@/lib/auth/context"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Salários & Vencimentos | Linke Logistics TMS",
  description: "Gestão e controlo de folha salarial, recibos de vencimento e retenções fiscais da equipa Linke Logistics.",
}

export default async function SalariosPage() {
  const ctx = await getAuthContext()

  const isSuperAdmin = Boolean(
    ctx?.user?.email?.toLowerCase().includes("stefano") ||
    ctx?.role === "admin" ||
    ctx?.permissions?.includes("Acesso Total (Super-Admin)")
  )
  const hasAccess = isSuperAdmin || Boolean(ctx?.permissions?.includes("Gestão de Salários & Vencimentos"))

  if (!hasAccess) {
    const userEmail = ctx?.user?.email
    const userName = ctx?.user?.user_metadata?.full_name || ctx?.user?.email?.split("@")[0] || "Colaborador"
    return <SalariosRestrictedAccess userEmail={userEmail} userName={userName} />
  }

  const salarios = await getSalariosAction()

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <SalariosClient initialSalarios={salarios || []} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
