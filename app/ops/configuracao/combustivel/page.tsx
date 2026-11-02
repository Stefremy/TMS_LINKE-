import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getStandardFuelSurchargeAction } from "@/app/actions/fuel-surcharge"
import { StandardFuelSurchargeClient } from "./StandardFuelSurchargeClient"

export default async function CombustivelPage() {
  await requireOpsPageAccess("/ops/configuracao/combustivel")
  const settings = await getStandardFuelSurchargeAction()
  return <StandardFuelSurchargeClient initialPercentage={settings.fuelSurchargePct} initialUpdatedAt={settings.fuelUpdatedAt} />
}
