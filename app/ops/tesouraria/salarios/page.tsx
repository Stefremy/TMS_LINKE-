import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function SalariosPage() {
  await requireOpsPageAccess("/ops/tesouraria/salarios")

  redirect("/ops/tesouraria/reembolsos")
}
