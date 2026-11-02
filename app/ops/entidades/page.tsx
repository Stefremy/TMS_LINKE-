import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function EntidadesRedirectPage() {
  await requireOpsPageAccess("/ops/entidades")

  redirect("/ops/entidades/clientes")
}
