import { getDistributionZoneGroups } from "@/lib/services/geo/distribution-zones"
import { DistributionZonesClient } from "./components/DistributionZonesClient"

export default function ZonasDeEnvioPage() {
  return <DistributionZonesClient groups={getDistributionZoneGroups()} />
}
