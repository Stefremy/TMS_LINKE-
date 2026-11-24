"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { ShipmentForm } from "@/components/shipments/form/ShipmentForm"
import { useClientScope } from "./ClientScope"
import { shipmentPrefillFromParams } from "@/lib/ecommerce/order-shipment-prefill"

/** The previous flow was removed. */
export function ClientCreateGuia() {
  const { client } = useClientScope()
  const searchParams = useSearchParams()

  // Imported web-store orders arrive with every mapped field (see order-shipment-prefill).
  const initialValues = useMemo(() => shipmentPrefillFromParams(searchParams), [searchParams])

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

