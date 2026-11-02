import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { getCarrierLogosSettingsAction, getAvailableLogoFilesAction } from "@/app/actions/carrier-logos"
import { CarrierLogosClient } from "./components/CarrierLogosClient"

export const dynamic = "force-dynamic"

export default async function CarrierLogosPage() {
  await requireOpsPageAccess("/ops/configuracao/transportadoras")

  const [settings, availableFiles] = await Promise.all([
    getCarrierLogosSettingsAction(),
    getAvailableLogoFilesAction(),
  ])

  return (
    <CarrierLogosClient 
      initialSettings={settings} 
      availableLogos={availableFiles} 
    />
  )
}
