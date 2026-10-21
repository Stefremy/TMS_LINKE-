"use client"

import { useEffect, useEffectEvent } from "react"

/** Keep carrier calls out of the Server Action queue; never overlap or refresh unchanged data. */
export function useTrackingPolling(shipmentIds: string[], onUpdated: (signal: AbortSignal) => void | Promise<void>) {
  const onUpdatedEvent = useEffectEvent(onUpdated)
  const selection = JSON.stringify([...new Set(shipmentIds.filter(Boolean))].sort().slice(0, 50))

  useEffect(() => {
    const ids: string[] = JSON.parse(selection)
    if (ids.length === 0) return
    let active = true
    let pending = false
    let controller: AbortController | undefined

    const poll = async () => {
      if (!active || pending || document.visibilityState !== "visible") return
      pending = true
      controller = new AbortController()
      try {
        const response = await fetch("/api/tracking/sync", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shipmentIds: ids }),
          signal: controller.signal,
        })
        if (!response.ok) return
        const result = await response.json()
        if (active && result.updatedCount > 0) await onUpdatedEvent(controller.signal)
      } catch {
        // A background failure must not interrupt navigation or replay a mutation.
      } finally {
        pending = false
      }
    }

    const initial = setTimeout(() => { void poll() }, 1500)
    const interval = setInterval(() => { void poll() }, 300000)
    return () => {
      active = false
      clearTimeout(initial)
      clearInterval(interval)
      controller?.abort()
    }
  }, [selection])
}
