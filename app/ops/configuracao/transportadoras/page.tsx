import { getCarrierLogosSettingsAction, getAvailableLogoFilesAction } from "@/app/actions/carrier-logos"
import { CarrierLogosClient } from "./components/CarrierLogosClient"

export const dynamic = "force-dynamic"

export default async function CarrierLogosPage() {
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
