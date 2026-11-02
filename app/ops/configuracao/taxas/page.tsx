import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getStandardSpecialFeesAction } from "@/app/actions/special-fees"
import { StandardSpecialFeesClient } from "./StandardSpecialFeesClient"

export default async function TaxasEGasoleoPage() {
  await requireOpsPageAccess("/ops/configuracao/taxas")
  const settings = await getStandardSpecialFeesAction()
  return <StandardSpecialFeesClient initialFees={settings.fees} initialUpdatedAt={settings.updatedAt} />
}
