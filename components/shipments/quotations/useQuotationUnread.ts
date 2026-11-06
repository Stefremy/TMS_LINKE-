"use client"

import { startTransition, useEffect, useState } from "react"
import { QUOTATION_UNREAD_EVENT } from "@/lib/shipments/quotations/types"

/** One poll for desktop and mobile navigation; pause while the tab is hidden. */
export function useQuotationUnread(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true, inFlight = false, generation = 0
    const refresh = () => {
      if (!active || inFlight || document.visibilityState === "hidden") return
      inFlight = true
      const started = generation
      startTransition(async () => {
        try {
          const { getUnreadShipmentQuotationsAction } = await import("@/app/actions/shipment-quotations")
          const next = await getUnreadShipmentQuotationsAction()
          if (active && started === generation) setCount(next)
        } catch { /* Keep the last confirmed count on a temporary network/auth failure. */ }
        finally { inFlight = false }
      })
    }
    const changed = (event: Event) => {
      if (!active) return
      const next = (event as CustomEvent<{ count?: number }>).detail?.count
      if (typeof next === "number" && Number.isSafeInteger(next) && next >= 0) { generation++; setCount(next) }
      else refresh()
    }
    refresh()
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener(QUOTATION_UNREAD_EVENT, changed)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener(QUOTATION_UNREAD_EVENT, changed)
    }
  }, [enabled])
  return enabled ? count : 0
}
