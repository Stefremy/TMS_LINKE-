"use client"

import { ShipmentForm } from "@/components/shipments/form/ShipmentForm"
import { useClientScope } from "./ClientScope"

/** The previous flow is retained in LegacyClientCreateGuia until both roles are approved. */
export function ClientCreateGuia() {
  const { client } = useClientScope()
  return <ShipmentForm key={client.id} role="client" client={client} hideQuotationServices />
}
