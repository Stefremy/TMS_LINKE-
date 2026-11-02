import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function ConfiguracaoRedirectPage() {
  await requireOpsPageAccess("/ops/configuracao")

  redirect("/ops/configuracao/geral")
}
