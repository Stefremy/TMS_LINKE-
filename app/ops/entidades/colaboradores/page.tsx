import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getColaboradoresAction } from "@/app/actions/colaboradores"
import { getAuthContext } from "@/lib/auth/context"
import { ColaboradoresClient } from "./components/ColaboradoresClient"

export const dynamic = "force-dynamic"

export default async function ColaboradoresPage() {
  await requireOpsPageAccess("/ops/entidades/colaboradores")

  const [colaboradores, ctx] = await Promise.all([
    getColaboradoresAction(),
    getAuthContext(),
  ])

  const isSuperAdmin = ctx?.role === "admin"

  return (
    <ColaboradoresClient
      initialColaboradores={colaboradores || []}
      isSuperAdmin={Boolean(isSuperAdmin)}
    />
  )
}
