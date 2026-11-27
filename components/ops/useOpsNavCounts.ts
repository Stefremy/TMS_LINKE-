"use client"

import { useEffect, useState } from "react"
import { OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT, PICKUP_REQUESTS_CHANGED_EVENT } from "@/lib/pickup-request-notifications"
import { SUPPORT_REQUESTS_CHANGED_EVENT } from "@/lib/support-requests/types"
import { QUOTATION_UNREAD_EVENT } from "@/lib/shipments/quotations/types"

type Key = "quotes" | "pickups" | "support"
type Counts = Record<Key, number>
const POLL_MS = 60_000

/** One background request for all Ops sidebar badges; pauses in hidden tabs and never runs two at once. */
export function useOpsNavCounts(enabled: Record<Key, boolean>) {
  const [counts, setCounts] = useState<Counts>({ quotes: 0, pickups: 0, support: 0 })
  const want = (Object.keys(enabled) as Key[]).filter(key => enabled[key]).join(",")
  useEffect(() => {
    if (!want) return
    let active = true, inFlight = false, queued = false, generation = 0
    const previous: Partial<Counts> = {}
    const refresh = async () => {
      if (!active || document.visibilityState === "hidden") return
      if (inFlight) { queued = true; return }
      inFlight = true
      const started = generation
      try {
        const res = await fetch(`/api/ops/nav-counts?want=${want}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json() as Partial<Record<Key, number | null>>
        // A refresh requested meanwhile (generation++) supersedes this answer.
        if (!active || started !== generation) return
        let alert = false
        const next: Partial<Counts> = {}
        for (const key of ["quotes", "pickups", "support"] as Key[]) {
          const value = data[key]
          if (typeof value !== "number") continue // keep the last confirmed count on failure
          next[key] = value
          if (key !== "quotes" && previous[key] !== undefined && previous[key] !== value) alert = true
          previous[key] = value
        }
        setCounts(prev => ({ ...prev, ...next }))
        if (alert) window.dispatchEvent(new Event(OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT))
      } catch { /* temporary network failure: keep the last counts */ }
      finally { inFlight = false; if (active && queued) { queued = false; void refresh() } }
    }
    const changed = () => { generation++; void refresh() }
    const quotesChanged = (event: Event) => {
      const next = (event as CustomEvent<{ count?: number }>).detail?.count
      if (typeof next === "number" && Number.isSafeInteger(next) && next >= 0) { generation++; setCounts(prev => ({ ...prev, quotes: next })) }
      else changed()
    }
    const onRefresh = () => { void refresh() }
    void refresh()
    const interval = window.setInterval(onRefresh, POLL_MS)
    window.addEventListener("focus", onRefresh)
    document.addEventListener("visibilitychange", onRefresh)
    window.addEventListener(PICKUP_REQUESTS_CHANGED_EVENT, changed)
    window.addEventListener(SUPPORT_REQUESTS_CHANGED_EVENT, changed)
    window.addEventListener(QUOTATION_UNREAD_EVENT, quotesChanged)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("focus", onRefresh)
      document.removeEventListener("visibilitychange", onRefresh)
      window.removeEventListener(PICKUP_REQUESTS_CHANGED_EVENT, changed)
      window.removeEventListener(SUPPORT_REQUESTS_CHANGED_EVENT, changed)
      window.removeEventListener(QUOTATION_UNREAD_EVENT, quotesChanged)
    }
  }, [want])
  return {
    quotes: enabled.quotes ? counts.quotes : 0,
    pickups: enabled.pickups ? counts.pickups : 0,
    support: enabled.support ? counts.support : 0,
  }
}
