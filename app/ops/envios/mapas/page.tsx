import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function MapasPage() {
  await requireOpsPageAccess("/ops/envios/mapas")

  redirect("/ops/tracking")
}
