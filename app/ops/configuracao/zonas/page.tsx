import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getDistributionZoneGroups } from "@/lib/services/geo/distribution-zones"
import { DistributionZonesClient } from "./components/DistributionZonesClient"

export default async function ZonasDeEnvioPage() {
  await requireOpsPageAccess("/ops/configuracao/zonas")

  return <DistributionZonesClient groups={getDistributionZoneGroups()} />
}
