"use client"

import { startTransition, useEffect, useState } from "react"
import { OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT, PICKUP_REQUESTS_CHANGED_EVENT } from "@/lib/pickup-request-notifications"

/** One lightweight poll shared by desktop/mobile; reading a request does not clear pending work. */
export function usePickupRequestCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true, inFlight = false, queued = false, generation = 0, previousCount: number | null = null
    const refresh = () => {
      if (!active || document.visibilityState === "hidden") return
      if (inFlight) { queued = true; return }
      inFlight = true
      const started = generation
      startTransition(async () => {
        try {
          const { getPendingClientPickupRequestsCountAction } = await import("@/app/actions/client-pickup-requests")
          const next = await getPendingClientPickupRequestsCountAction()
          if (active && started === generation) {
            setCount(next)
            if (previousCount !== null && previousCount !== next) window.dispatchEvent(new Event(OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT))
            previousCount = next
          }
        } catch { /* Retain the last confirmed count on temporary failures. */ }
        finally { inFlight = false; if (active && queued) { queued = false; refresh() } }
      })
    }
    const changed = () => { generation++; refresh() }
    refresh()
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener(PICKUP_REQUESTS_CHANGED_EVENT, changed)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener(PICKUP_REQUESTS_CHANGED_EVENT, changed)
    }
  }, [enabled])
  return enabled ? count : 0
}
