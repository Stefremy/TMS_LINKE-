import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function FaturacaoRedirectPage() {
  await requireOpsPageAccess("/ops/faturacao")

  redirect("/ops/faturacao/contas-corrente")
}
