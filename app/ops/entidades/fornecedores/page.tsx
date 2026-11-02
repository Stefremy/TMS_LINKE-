import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import * as React from "react"
import { getFornecedoresAction } from "@/app/actions/fornecedores"
import { FornecedoresClient } from "./components/FornecedoresClient"

export const dynamic = "force-dynamic"

export default async function FornecedoresPage() {
  await requireOpsPageAccess("/ops/entidades/fornecedores")

  const fornecedores = await getFornecedoresAction()

  return (
    <div className="py-2">
      <FornecedoresClient initialFornecedores={fornecedores} />
    </div>
  )
}
