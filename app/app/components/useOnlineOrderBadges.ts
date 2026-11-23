"use client"

import * as React from "react"
import { getClientOnlineOrderBadgesAction } from "@/app/actions/client-ecommerce"

type Badge = { order_number: string; store_name: string }
type ShipmentKey = { id?: string | null; tracking_number?: string | null }

/** Web-store order behind each shipment of this client; `badgeFor` returns undefined for manual shipments. */
export function useOnlineOrderBadges(clientId: string) {
  const [badges, setBadges] = React.useState<Record<string, Badge>>({})
  React.useEffect(() => {
    let active = true
    getClientOnlineOrderBadgesAction(clientId).then(next => { if (active) setBadges(next) }).catch(() => {})
    return () => { active = false }
  }, [clientId])
  return React.useCallback((shipment: ShipmentKey): Badge | undefined =>
    (shipment.id ? badges[shipment.id] : undefined) || (shipment.tracking_number ? badges[shipment.tracking_number] : undefined), [badges])
}
