import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function EstadosPage() {
  await requireOpsPageAccess("/ops/configuracao/estados")

  redirect("/ops/configuracao/geral")
}
