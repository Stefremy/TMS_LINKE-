import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getOpsGamesDashboardAction } from "@/app/actions/ops-games"
import { OpsBrainGamesClient } from "./OpsBrainGamesClient"

export const dynamic = "force-dynamic"

export default async function OpsBrainGamesPage() {
  await requireOpsPageAccess("/ops/jogos")

  const initialDashboard = await getOpsGamesDashboardAction()

  return <OpsBrainGamesClient initialDashboard={initialDashboard} />
}

