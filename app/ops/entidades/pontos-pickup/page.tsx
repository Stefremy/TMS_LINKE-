import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getPontosPickupCttAction } from "@/app/actions/ctt"
import { PontosPickupClient } from "./components/PontosPickupClient"

export const dynamic = "force-dynamic"

export default async function PontosPickupPage() {
  await requireOpsPageAccess("/ops/entidades/pontos-pickup")

  const result = await getPontosPickupCttAction()

  return (
    <PontosPickupClient
      initialPoints={result.points || []}
      initialCachedAt={result.cachedAt}
      initialError={result.error}
    />
  )
}
