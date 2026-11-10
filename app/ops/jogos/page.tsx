import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getOpsGamesDashboardAction } from "@/app/actions/ops-games"
import { OpsBrainGamesClient } from "./OpsBrainGamesClient"
import { getLisbonDateKey } from "./lib/puzzle-generator"

export const dynamic = "force-dynamic"

export default async function OpsBrainGamesPage() {
  await requireOpsPageAccess("/ops/jogos")

  const initialDashboard = await getOpsGamesDashboardAction()
  const dailyKey = getLisbonDateKey()

  return <OpsBrainGamesClient initialDashboard={initialDashboard} dailyKey={dailyKey} />
}

