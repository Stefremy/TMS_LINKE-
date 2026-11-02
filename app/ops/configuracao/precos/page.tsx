import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function PrecosPage() {
  await requireOpsPageAccess("/ops/configuracao/precos")

  redirect("/ops/configuracao/servicos")
}
