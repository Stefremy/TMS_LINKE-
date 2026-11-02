import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function RastreabilidadePage() {
  await requireOpsPageAccess("/ops/envios/rastreabilidade")

  redirect("/ops/envios")
}
