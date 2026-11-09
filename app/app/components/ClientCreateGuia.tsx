"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { ShipmentForm } from "@/components/shipments/form/ShipmentForm"
import { useClientScope } from "./ClientScope"

/** The previous flow is retained in LegacyClientCreateGuia until both roles are approved. */
export function ClientCreateGuia() {
  const { client } = useClientScope()
  const searchParams = useSearchParams()

  const initialValues = useMemo(() => {
    const destName = searchParams.get("dest_name") || searchParams.get("name")
    const destAddress = searchParams.get("dest_address") || searchParams.get("address")
    const destPostal = searchParams.get("dest_postal") || searchParams.get("postal")
    const destCity = searchParams.get("dest_city") || searchParams.get("city")
    const destCountry = searchParams.get("dest_country") || searchParams.get("country") || "PT"
    const destPhone = searchParams.get("dest_phone") || searchParams.get("phone")
    const destEmail = searchParams.get("dest_email") || searchParams.get("email")
    const destCod = searchParams.get("dest_cod") || searchParams.get("cod")
    const destRef = searchParams.get("dest_ref") || searchParams.get("ref")
    const destObs = searchParams.get("obs")

    if (!destName && !destAddress && !destPhone && !destRef) {
      return undefined
    }

    return {
      recipientName: destName || "",
      recipientAddress: destAddress || "",
      recipientPostal: destPostal || "",
      recipientCity: destCity || "",
      recipientCountry: destCountry.toUpperCase(),
      recipientPhone: destPhone || "",
      recipientEmail: destEmail || "",
      codValue: destCod ? parseFloat(destCod) : 0,
      selectedSpecialServices: destCod && parseFloat(destCod) > 0 ? ["cod"] : [],
      observations: destRef ? `Encomenda ${destRef}` : (destObs || ""),
    }
  }, [searchParams])

  const formKey = useMemo(() => {
    const ref = searchParams.get("dest_ref") || searchParams.get("name") || ""
    return `${client.id}-${ref}`
  }, [client.id, searchParams])

  return (
    <ShipmentForm
      key={formKey}
      role="client"
      client={client}
      initialValues={initialValues}
      hideQuotationServices
    />
  )
}

