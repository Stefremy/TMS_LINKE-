"use client"

import { useRouter } from "next/navigation"
import { useTrackingPolling } from "@/lib/hooks/useTrackingPolling"

export function OpsDashboardClientSync({ activeIds }: { activeIds: string[] }) {
  const router = useRouter()
  useTrackingPolling(activeIds, () => router.refresh())
  return null
}
