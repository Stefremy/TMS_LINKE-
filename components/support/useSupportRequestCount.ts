"use client"

import { startTransition, useEffect, useState } from "react"
import { OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT } from "@/lib/pickup-request-notifications"
import { SUPPORT_REQUESTS_CHANGED_EVENT } from "@/lib/support-requests/types"

/** Open client support requests for the Ops sidebar badge (same 30s poll as pickup requests). */
export function useSupportRequestCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true, inFlight = false, previous: number | null = null
    const refresh = () => {
      if (!active || inFlight || document.visibilityState === "hidden") return
      inFlight = true
      startTransition(async () => {
        try {
          const { getOpenSupportRequestsCountAction } = await import("@/app/actions/support-requests")
          const next = await getOpenSupportRequestsCountAction()
          if (!active) return
          setCount(next)
          if (previous !== null && previous !== next) window.dispatchEvent(new Event(OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT))
          previous = next
        } catch { /* keep the last confirmed count */ }
        finally { inFlight = false }
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener(SUPPORT_REQUESTS_CHANGED_EVENT, refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener(SUPPORT_REQUESTS_CHANGED_EVENT, refresh)
    }
  }, [enabled])
  return enabled ? count : 0
}
