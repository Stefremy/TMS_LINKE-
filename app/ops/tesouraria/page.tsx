import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { redirect } from "next/navigation"

export default async function TesourariaRedirectPage() {
  await requireOpsPageAccess("/ops/tesouraria")

  redirect("/ops/tesouraria/reembolsos")
}
