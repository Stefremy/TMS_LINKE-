import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function FaturaPersonalizadaPage() {
  await requireOpsPageAccess("/ops/faturacao/personalizada")

  redirect("/ops/faturacao/clientes")
}
